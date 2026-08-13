import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { DesignProcessingService } from './design-processing.service';

@Module({
  imports: [forwardRef(() => DesignsModule), FileStorageModule],
  providers: [DesignProcessingService],
  exports: [DesignProcessingService],
})
export class DesignProcessingModule {}
