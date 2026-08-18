import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Design, DesignStatus } from './entities/design.entity';
import { FileStorageService } from '../file-storage/file-storage.service';

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

export function toSafeDesignDto(design: Design): SafeDesignDto {
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

@Injectable()
export class DesignsService {
  constructor(
    @InjectModel(Design)
    private readonly designModel: typeof Design,
    private readonly fileStorage: FileStorageService,
  ) {}

  toSafeDto(design: Design): SafeDesignDto {
    return toSafeDesignDto(design);
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
