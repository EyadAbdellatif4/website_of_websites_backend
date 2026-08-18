import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { FileStorageService } from '../file-storage/file-storage.service';
import { DesignsService, SafeDesignDto, toSafeDesignDto } from '../designs/designs.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { validateImportFile } from '../../common/utils/file-validation.util';
import {
  extractZipEntries,
  ExtractedZipEntry,
} from '../../common/utils/zip.util';
import {
  SvgInspector,
  SvgInspectionMetadata,
} from './inspectors/svg.inspector';
import {
  ImageInspector,
  ImageInspectionMetadata,
} from './inspectors/image.inspector';
import {
  FontInspector,
  FontInspectionMetadata,
} from './inspectors/font.inspector';

export interface NormalizedFileEntry {
  path: string;
  type: 'svg' | 'image' | 'font' | 'other';
  size: number;
  metadata:
    | SvgInspectionMetadata
    | ImageInspectionMetadata
    | FontInspectionMetadata
    | Record<string, unknown>;
}

export interface NormalizedDesignRepresentation {
  designId: string;
  userId: string;
  extractedDir: string;
  fileInventory: NormalizedFileEntry[];
  summary: {
    totalFiles: number;
    svgCount: number;
    imageCount: number;
    fontCount: number;
    otherCount: number;
  };
}

@Injectable()
export class DesignProcessingService {
  private readonly svgInspector = new SvgInspector();
  private readonly imageInspector = new ImageInspector();
  private readonly fontInspector = new FontInspector();

  // In-memory cache for normalized processing results
  private readonly resultsCache = new Map<string, NormalizedDesignRepresentation>();

  constructor(
    @InjectModel(Design)
    private readonly designModel: typeof Design,
    private readonly fileStorage: FileStorageService,
    private readonly designsService: DesignsService,
    private readonly configService: ConfigService,
  ) {}

  async upload(
    user: User,
    file: Express.Multer.File,
    name: string,
  ): Promise<SafeDesignDto> {
    if (!name?.trim()) {
      throw new BadRequestException('Design name is required');
    }

    const maxSize = Number(
      this.configService.get<number>('MAX_DESIGN_ZIP_SIZE', 52428800),
    );
    const validated = validateImportFile(file, { maxSizeBytes: maxSize });

    const designId = crypto.randomUUID();
    const storageKey = `designs/${user.id}/${designId}/original.zip`;

    await this.fileStorage.saveFile(storageKey, validated.buffer);

    const design = await this.designModel.create({
      id: designId,
      user_id: user.id,
      name: name.trim(),
      file_name: validated.sanitizedName,
      storage_key: storageKey,
      file_size: validated.size,
      status: DesignStatus.UPLOADED,
    });

    return toSafeDesignDto(design);
  }

  private inspectEntry(entry: ExtractedZipEntry): NormalizedFileEntry {
    let metadata: NormalizedFileEntry['metadata'] = {};
    if (entry.type === 'svg') {
      metadata = this.svgInspector.inspect(entry.buffer.toString('utf-8'));
    } else if (entry.type === 'image') {
      metadata = this.imageInspector.inspect(entry.buffer, entry.entryPath);
    } else if (entry.type === 'font') {
      metadata = this.fontInspector.inspect(entry.buffer, entry.entryPath);
    }

    return {
      path: entry.entryPath,
      type: entry.type,
      size: entry.size,
      metadata,
    };
  }

  async processDesign(
    designId: string,
    userId: string,
  ): Promise<NormalizedDesignRepresentation> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (design.status === DesignStatus.PROCESSING) {
      throw new ConflictException('Design processing is already in progress');
    }

    design.status = DesignStatus.PROCESSING;
    await design.save();

    try {
      const buffer = await this.fileStorage.getFile(design.storage_key);
      const canonicalExtractedDirKey = `designs/${userId}/${designId}/extracted`;

      const entries: ExtractedZipEntry[] = design.file_name.toLowerCase().endsWith('.svg')
        ? [{ entryPath: 'design.svg', buffer, size: buffer.length, type: 'svg' }]
        : extractZipEntries(buffer);

      // Save extracted files in parallel and inspect
      const fileInventory = await Promise.all(
        entries.map(async (entry) => {
          await this.fileStorage.saveFile(
            `${canonicalExtractedDirKey}/${entry.entryPath}`,
            entry.buffer,
          );
          return this.inspectEntry(entry);
        }),
      );

      const representation: NormalizedDesignRepresentation = {
        designId,
        userId,
        extractedDir: canonicalExtractedDirKey,
        fileInventory,
        summary: {
          totalFiles: fileInventory.length,
          svgCount: fileInventory.filter((f) => f.type === 'svg').length,
          imageCount: fileInventory.filter((f) => f.type === 'image').length,
          fontCount: fileInventory.filter((f) => f.type === 'font').length,
          otherCount: fileInventory.filter((f) => f.type === 'other').length,
        },
      };

      this.resultsCache.set(designId, representation);
      design.status = DesignStatus.READY;
      await design.save();

      return representation;
    } catch (err) {
      design.status = DesignStatus.FAILED;
      await design.save();
      throw err;
    }
  }

  async getProcessingResult(
    designId: string,
    userId: string,
  ): Promise<NormalizedDesignRepresentation> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (design.status !== DesignStatus.READY) {
      throw new BadRequestException(
        `Design is not in READY status (current status: ${design.status})`,
      );
    }

    const cached = this.resultsCache.get(designId);
    if (cached) {
      return cached;
    }

    throw new NotFoundException('Processing metadata not found');
  }
}
