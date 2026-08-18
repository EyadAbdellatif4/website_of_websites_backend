import { Module, forwardRef } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { DesignProcessingModule } from '../design-processing/design-processing.module';
import { DesignAnalysisService } from './design-analysis.service';
import { DesignAnalyzerController } from './design-analyzer.controller';
import { DESIGN_ANALYZER_PROVIDER } from './interfaces/design-analyzer.interface';
import { GeminiDesignAnalyzer } from './providers/gemini-design-analyzer.provider';
import { MockDesignAnalyzer } from './providers/mock-design-analyzer.provider';

@Module({
  imports: [
    forwardRef(() => DesignsModule),
    forwardRef(() => DesignProcessingModule),
  ],
  controllers: [DesignAnalyzerController],
  providers: [
    DesignAnalysisService,
    {
      provide: DESIGN_ANALYZER_PROVIDER,
      useFactory: (gemini: GeminiDesignAnalyzer, mock: MockDesignAnalyzer) => {
        if (process.env.USE_MOCK_ANALYZER === 'true') {
          return mock;
        }
        return gemini;
      },
      inject: [GeminiDesignAnalyzer, MockDesignAnalyzer],
    },
    GeminiDesignAnalyzer,
    MockDesignAnalyzer,
  ],
  exports: [DesignAnalysisService, DESIGN_ANALYZER_PROVIDER],
})
export class DesignAnalyzerModule {}
