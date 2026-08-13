import { NormalizedDesignRepresentation } from '../../design-processing/design-processing.service';
import { AnalysisResult } from '../schemas/analysis-result.schema';

export const DESIGN_ANALYZER_PROVIDER = 'DESIGN_ANALYZER_PROVIDER';

export interface DesignAnalyzerInput {
  representation: NormalizedDesignRepresentation;
  svgContents?: Map<string, string>;
}

export abstract class DesignAnalyzer {
  abstract analyze(input: DesignAnalyzerInput): Promise<AnalysisResult>;
}
