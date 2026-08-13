import { Module } from '@nestjs/common';
import { DesignAnalyzerModule } from '../design-analyzer/design-analyzer.module';

@Module({
  imports: [DesignAnalyzerModule],
  exports: [DesignAnalyzerModule],
})
export class DesignAnalysisModule {}
