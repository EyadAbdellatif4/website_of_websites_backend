import { Module } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { DesignProcessingService } from './design-processing.service';

@Module({
  imports: [DesignsModule],
  providers: [DesignProcessingService],
  exports: [DesignProcessingService],
})
export class DesignProcessingModule {}
