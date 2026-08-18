import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { DesignProcessingService } from './design-processing.service';
import { DesignProcessingController } from './design-processing.controller';

@Module({
  imports: [forwardRef(() => DesignsModule), FileStorageModule],
  controllers: [DesignProcessingController],
  providers: [DesignProcessingService],
  exports: [DesignProcessingService],
})
export class DesignProcessingModule {}
