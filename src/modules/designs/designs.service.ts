import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Design, DesignStatus } from './entities/design.entity';
import { User } from '../users/entities/user.entity';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { FileStorage } from '../file-storage/file-storage.interface';
import { validateZipFile } from './utils/zip-validator.util';

export interface SafeDesignDto {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  status: DesignStatus;
  layoutData: Record<string, unknown> | null;
  placeholdersData: Array<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DesignsService {
  constructor(
    @InjectModel(Design)
    private readonly designModel: typeof Design,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
    private readonly configService: ConfigService,
  ) {}

  toSafeDto(design: Design): SafeDesignDto {
    return {
      id: design.id,
      name: design.name,
      fileName: design.file_name,
      fileSize: Number(design.file_size),
      status: design.status,
      layoutData: design.layout_data,
      placeholdersData: design.placeholders_data,
      createdAt: design.created_at,
      updatedAt: design.updated_at,
    };
  }

  async getDesignEntity(id: string, userId: string): Promise<Design> {
    const design = await this.designModel.findByPk(id);
    if (!design || design.user_id !== userId) {
      throw new NotFoundException('Design not found');
    }
    return design;
  }

  async updateStatus(
    id: string,
    userId: string,
    status: DesignStatus,
  ): Promise<Design> {
    const design = await this.getDesignEntity(id, userId);
    design.status = status;
    await design.save();
    return design;
  }

  async uploadDesign(
    user: User,
    file: Express.Multer.File,
    name: string,
  ): Promise<SafeDesignDto> {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('Design name is required');
    }

    validateZipFile(file);

    const maxSize = this.configService.get<number>(
      'maxDesignZipSize',
      52428800,
    );
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size (${file.size} bytes) exceeds maximum allowed limit of ${maxSize} bytes`,
      );
    }

    const designId = crypto.randomUUID();
    const storageKey = `designs/${user.id}/${designId}/original.zip`;

    // 1. Store physical file first using FileStorage abstraction
    await this.fileStorage.saveFile(storageKey, file.buffer);

    // 2. Create database record; clean up storage file if DB creation fails
    try {
      const design = await this.designModel.create({
        id: designId,
        user_id: user.id,
        name: name.trim(),
        file_name: file.originalname,
        storage_key: storageKey,
        file_size: file.size,
        status: DesignStatus.UPLOADED,
        layout_data: null,
        placeholders_data: null,
      });

      return this.toSafeDto(design);
    } catch (dbErr) {
      // Compensating action: clean up saved storage file so no orphaned file is left
      try {
        await this.fileStorage.deleteFile(storageKey);
      } catch (cleanupErr) {
        console.error(
          `Failed to clean up file '${storageKey}' after DB failure:`,
          cleanupErr,
        );
      }
      throw new InternalServerErrorException(
        `Failed to save design database record: ${dbErr instanceof Error ? dbErr.message : 'Unknown database error'}`,
      );
    }
  }

  async findAllForUser(userId: string): Promise<SafeDesignDto[]> {
    const designs = await this.designModel.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
    return designs.map((d) => this.toSafeDto(d));
  }

  async findOneForUser(id: string, userId: string): Promise<SafeDesignDto> {
    const design = await this.getDesignEntity(id, userId);
    return this.toSafeDto(design);
  }

  async deleteForUser(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const design = await this.getDesignEntity(id, userId);
    const storageKey = design.storage_key;

    // Delete physical file safely (ignores ENOENT if file is already missing)
    await this.fileStorage.deleteFile(storageKey);

    // Delete DB record
    await design.destroy();

    return { message: 'Design deleted successfully' };
  }

  async getDesignFileBuffer(
    id: string,
    userId: string,
  ): Promise<{ design: Design; buffer: Buffer }> {
    const design = await this.getDesignEntity(id, userId);
    const buffer = await this.fileStorage.getFile(design.storage_key);
    return { design, buffer };
  }
}
