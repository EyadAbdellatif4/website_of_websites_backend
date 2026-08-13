import { Module } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { DesignAnalysisService } from './design-analysis.service';

@Module({
  imports: [DesignsModule],
  providers: [DesignAnalysisService],
  exports: [DesignAnalysisService],
})
export class DesignAnalysisModule {}
