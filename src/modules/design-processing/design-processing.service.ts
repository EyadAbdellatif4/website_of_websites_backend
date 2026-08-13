import { Injectable, Inject } from '@nestjs/common';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { FileStorage } from '../file-storage/file-storage.interface';
import { DesignsService } from '../designs/designs.service';

@Injectable()
export class DesignProcessingService {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
    private readonly designsService: DesignsService,
  ) {}

  // ZIP extraction, validation, and security sanitization will be implemented in future phase.
}
