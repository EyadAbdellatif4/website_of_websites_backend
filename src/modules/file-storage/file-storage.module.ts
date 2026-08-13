import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalFileStorageService } from './local-file-storage.service';
import { FILE_STORAGE_SERVICE } from './storage.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LocalFileStorageService,
    {
      provide: FILE_STORAGE_SERVICE,
      useExisting: LocalFileStorageService,
    },
  ],
  exports: [LocalFileStorageService, FILE_STORAGE_SERVICE],
})
export class FileStorageModule {}
