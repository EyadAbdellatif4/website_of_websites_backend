import { Injectable } from '@nestjs/common';
import {
  DesignAnalyzer,
  DesignAnalyzerInput,
} from '../interfaces/design-analyzer.interface';
import {
  AnalysisResult,
  AnalysisResultSchema,
} from '../schemas/analysis-result.schema';

@Injectable()
export class MockDesignAnalyzer implements DesignAnalyzer {
  public shouldFail = false;
  public failureMessage = 'Simulated AI provider error';
  public mockResponseOverride: AnalysisResult | null = null;

  async analyze(input: DesignAnalyzerInput): Promise<AnalysisResult> {
    await Promise.resolve();
    const designId = input.representation?.designId ?? 'mock-design';

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    if (this.mockResponseOverride) {
      return AnalysisResultSchema.parse(this.mockResponseOverride);
    }

    // Default valid mock analysis result built from input dimensions
    const width = 1440;
    const height = 1800;

    const mockResult: AnalysisResult = {
      layout: {
        width,
        height,
        sections: [
          {
            id: 'section_header',
            type: 'navbar',
            order: 1,
            bounds: { x: 0, y: 0, width: 1440, height: 80 },
          },
          {
            id: 'section_hero',
            type: 'hero',
            order: 2,
            bounds: { x: 0, y: 80, width: 1440, height: 720 },
          },
          {
            id: 'section_features',
            type: 'features',
            order: 3,
            bounds: { x: 0, y: 800, width: 1440, height: 600 },
          },
          {
            id: 'section_footer',
            type: 'footer',
            order: 4,
            bounds: { x: 0, y: 1400, width: 1440, height: 400 },
          },
        ],
      },
      placeholders: [
        {
          id: `ph_logo_${designId.slice(0, 8)}`,
          type: 'image',
          role: 'logo',
          section_id: 'section_header',
          bounds: { x: 40, y: 20, width: 120, height: 40 },
          content_hint: 'assets/logo.png',
        },
        {
          id: 'ph_nav_home',
          type: 'link',
          role: 'navigation_link',
          section_id: 'section_header',
          bounds: { x: 800, y: 30, width: 60, height: 20 },
          content_hint: 'Home',
        },
        {
          id: 'ph_hero_title',
          type: 'text',
          role: 'hero_heading',
          section_id: 'section_hero',
          bounds: { x: 100, y: 200, width: 600, height: 100 },
          content_hint: 'Welcome to our platform',
        },
        {
          id: 'ph_hero_cta',
          type: 'button',
          role: 'cta_button',
          section_id: 'section_hero',
          bounds: { x: 100, y: 340, width: 180, height: 50 },
          content_hint: 'Get Started',
        },
        {
          id: 'ph_hero_img',
          type: 'image',
          role: 'hero_image',
          section_id: 'section_hero',
          bounds: { x: 800, y: 150, width: 540, height: 450 },
          content_hint: 'assets/hero.png',
        },
      ],
    };

    return AnalysisResultSchema.parse(mockResult);
  }
}
