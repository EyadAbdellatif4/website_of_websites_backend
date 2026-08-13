import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Design, DesignStatus } from './entities/design.entity';
import { CreateDesignDto } from './dto/create-design.dto';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { FileStorage } from '../file-storage/file-storage.interface';

@Injectable()
export class DesignsService {
  constructor(
    @InjectRepository(Design)
    private readonly designRepository: Repository<Design>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
  ) {}

  async findById(id: string): Promise<Design | null> {
    return this.designRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Design[]> {
    return this.designRepository.find({ where: { user_id: userId } });
  }

  async create(dto: CreateDesignDto): Promise<Design> {
    const design = this.designRepository.create({
      user_id: dto.userId,
      name: dto.name,
      file_name: dto.fileName,
      storage_key: dto.storageKey,
      file_size: dto.fileSize,
      status: DesignStatus.PENDING,
    });
    return this.designRepository.save(design);
  }
}
