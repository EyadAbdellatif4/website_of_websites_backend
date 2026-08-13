import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DesignsService, SafeDesignDto } from '../designs/designs.service';
import {
  DesignProcessingService,
  NormalizedDesignRepresentation,
} from '../design-processing/design-processing.service';
import { DesignStatus } from '../designs/entities/design.entity';
import {
  DesignAnalyzer,
  DESIGN_ANALYZER_PROVIDER,
} from './interfaces/design-analyzer.interface';
import {
  AnalysisResult,
  AnalysisResultSchema,
} from './schemas/analysis-result.schema';

export interface AnalysisResponseDto {
  design: SafeDesignDto;
  result: AnalysisResult;
}

@Injectable()
export class DesignAnalysisService {
  constructor(
    private readonly designsService: DesignsService,
    private readonly designProcessingService: DesignProcessingService,
    @Inject(DESIGN_ANALYZER_PROVIDER)
    private readonly analyzer: DesignAnalyzer,
  ) {}

  async analyzeDesign(
    designId: string,
    userId: string,
  ): Promise<AnalysisResponseDto> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (
      design.status !== DesignStatus.READY &&
      design.status !== DesignStatus.UPLOADED
    ) {
      throw new BadRequestException(
        `Design cannot be analyzed in status '${design.status}'. Please process the design first.`,
      );
    }

    // Retrieve normalized processing representation
    let representation: NormalizedDesignRepresentation;
    try {
      representation = await this.designProcessingService.getProcessingResult(
        designId,
        userId,
      );
    } catch {
      // If result not cached, run processing first
      representation = await this.designProcessingService.processDesign(
        designId,
        userId,
      );
    }

    let result: AnalysisResult;
    try {
      const rawResult = await this.analyzer.analyze({ representation });

      // Strict backend Zod validation check
      result = AnalysisResultSchema.parse(rawResult);
    } catch (err) {
      // Do NOT corrupt or overwrite existing DB data on analysis failure
      throw new InternalServerErrorException(
        `Design Analysis Failed: ${err instanceof Error ? err.message : 'Invalid AI output schema'}`,
      );
    }

    // Save layout_data and placeholders_data to existing DB columns
    design.layout_data = result.layout;
    design.placeholders_data = result.placeholders;
    design.status = DesignStatus.READY;
    await design.save();

    return {
      design: this.designsService.toSafeDto(design),
      result,
    };
  }

  async getAnalysisResult(
    designId: string,
    userId: string,
  ): Promise<AnalysisResponseDto> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.layout_data || !design.placeholders_data) {
      throw new BadRequestException('Design has not been analyzed yet.');
    }

    const layout = AnalysisResultSchema.shape.layout.parse(design.layout_data);
    const placeholders = AnalysisResultSchema.shape.placeholders.parse(
      design.placeholders_data,
    );

    return {
      design: this.designsService.toSafeDto(design),
      result: {
        layout,
        placeholders,
      },
    };
  }
}
