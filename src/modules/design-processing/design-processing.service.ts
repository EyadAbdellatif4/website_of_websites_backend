import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { FileStorage } from '../file-storage/file-storage.interface';
import { DesignsService } from '../designs/designs.service';
import { DesignStatus } from '../designs/entities/design.entity';
import {
  ZipProcessor,
  ZipProcessingLimits,
  ExtractedZipEntry,
} from './processors/zip.processor';
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
  private readonly zipProcessor = new ZipProcessor();
  private readonly svgInspector = new SvgInspector();
  private readonly imageInspector = new ImageInspector();
  private readonly fontInspector = new FontInspector();

  // In-memory cache for normalized processing results
  private readonly resultsCache = new Map<
    string,
    NormalizedDesignRepresentation
  >();

  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
    private readonly designsService: DesignsService,
    private readonly configService: ConfigService,
  ) {}

  async processDesign(
    designId: string,
    userId: string,
  ): Promise<NormalizedDesignRepresentation> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (design.status === DesignStatus.PROCESSING) {
      throw new ConflictException('Design processing is already in progress');
    }

    // Mark status as PROCESSING
    await this.designsService.updateStatus(
      designId,
      userId,
      DesignStatus.PROCESSING,
    );

    try {
      const { buffer } = await this.designsService.getDesignFileBuffer(
        designId,
        userId,
      );

      const limits: ZipProcessingLimits = {
        maxZipEntries: this.configService.get<number>('maxZipEntries', 500),
        maxZipUncompressedSize: this.configService.get<number>(
          'maxZipUncompressedSize',
          209715200,
        ),
        maxSingleExtractedFileSize: this.configService.get<number>(
          'maxSingleExtractedFileSize',
          52428800,
        ),
      };

      const canonicalExtractedDirKey = `designs/${userId}/${designId}/extracted`;

      const isDirectSvg =
        design.file_name.toLowerCase().endsWith('.svg') ||
        buffer.slice(0, 100).toString('utf-8').includes('<svg');

      let entries: ExtractedZipEntry[] = [];

      if (isDirectSvg) {
        entries = [
          {
            entryPath: 'design.svg',
            buffer,
            size: buffer.length,
            type: 'svg',
          },
        ];
      } else {
        // Safely extract ZIP entries in memory
        entries = this.zipProcessor.process(
          buffer,
          canonicalExtractedDirKey,
          limits,
        );
      }

      const fileInventory: NormalizedFileEntry[] = [];
      let svgCount = 0;
      let imageCount = 0;
      let fontCount = 0;
      let otherCount = 0;

      for (const entry of entries) {
        const fileKey = `${canonicalExtractedDirKey}/${entry.entryPath}`;

        // Save extracted file into storage under extracted path
        await this.fileStorage.saveFile(fileKey, entry.buffer);

        let metadata: NormalizedFileEntry['metadata'] = {};
        let normalizedType: NormalizedFileEntry['type'] = 'other';

        if (entry.type === 'svg') {
          normalizedType = 'svg';
          svgCount++;
          metadata = this.svgInspector.inspect(entry.buffer.toString('utf-8'));
        } else if (entry.type === 'image') {
          normalizedType = 'image';
          imageCount++;
          metadata = this.imageInspector.inspect(entry.buffer, entry.entryPath);
        } else if (entry.type === 'font') {
          normalizedType = 'font';
          fontCount++;
          metadata = this.fontInspector.inspect(entry.buffer, entry.entryPath);
        } else {
          otherCount++;
        }

        fileInventory.push({
          path: entry.entryPath,
          type: normalizedType,
          size: entry.size,
          metadata,
        });
      }

      const representation: NormalizedDesignRepresentation = {
        designId,
        userId,
        extractedDir: canonicalExtractedDirKey,
        fileInventory,
        summary: {
          totalFiles: fileInventory.length,
          svgCount,
          imageCount,
          fontCount,
          otherCount,
        },
      };

      this.resultsCache.set(designId, representation);

      // Mark status as READY
      await this.designsService.updateStatus(
        designId,
        userId,
        DesignStatus.READY,
      );

      return representation;
    } catch (err) {
      // Mark status as FAILED on error
      await this.designsService.updateStatus(
        designId,
        userId,
        DesignStatus.FAILED,
      );
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
