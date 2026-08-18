import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DesignAnalyzer,
  DesignAnalyzerInput,
} from '../interfaces/design-analyzer.interface';
import {
  AnalysisResult,
  AnalysisResultSchema,
} from '../schemas/analysis-result.schema';
import { DESIGN_ANALYZER_SYSTEM_PROMPT } from '../prompts/analyzer.prompt';

@Injectable()
export class GeminiDesignAnalyzer implements DesignAnalyzer {
  constructor(private readonly configService: ConfigService) {}

  async analyze(input: DesignAnalyzerInput): Promise<AnalysisResult> {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY;
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') ||
      process.env.GEMINI_MODEL ||
      'gemini-2.5-flash';

    if (!apiKey) {
      throw new InternalServerErrorException(
        'Gemini API Key is not configured (GEMINI_API_KEY environment variable missing)',
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Prepare prompt combining structural parser input with instructions
    const promptText = `
${DESIGN_ANALYZER_SYSTEM_PROMPT}

PROCESSED DESIGN STRUCTURE INPUT:
Design ID: ${input.representation.designId}
Summary: ${JSON.stringify(input.representation.summary, null, 2)}
File Inventory (Parsed Metadata & Extracted Text Nodes):
${JSON.stringify(input.representation.fileInventory, null, 2)}

INSTRUCTIONS FOR DETAILED STRUCTURAL EXTRACTION:
1. Examine all extracted text nodes and visual coordinates in the file inventory above.
2. Ensure you detect:
   - Logo / Brand at top left as a placeholder ("logo")
   - All navigation items in the header as individual "link" placeholders ("nav_link_1", "nav_link_2", ...)
   - Header action items / social links on right as "link" or "button" placeholders
   - Hero section headings, sub-headings, and body paragraphs as distinct "text" placeholders
   - All hero call-to-action buttons as distinct "button" placeholders ("cta_button_1", "cta_button_2")
   - Background images / visual mesh graphics as "image" placeholders
   - Section color palettes (background_color, text_color, primary_color, secondary_color)
3. Return the structured JSON matching the JSON schema.
`;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              layout: {
                type: Type.OBJECT,
                properties: {
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  sections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        type: { type: Type.STRING },
                        order: { type: Type.INTEGER },
                        bounds: {
                          type: Type.OBJECT,
                          properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                            width: { type: Type.NUMBER },
                            height: { type: Type.NUMBER },
                          },
                          required: ['x', 'y', 'width', 'height'],
                        },
                        styles: {
                          type: Type.OBJECT,
                          properties: {
                            background_color: { type: Type.STRING },
                            text_color: { type: Type.STRING },
                            primary_color: { type: Type.STRING },
                            secondary_color: { type: Type.STRING },
                          },
                        },
                      },
                      required: ['id', 'type', 'bounds'],
                    },
                  },
                },
                required: ['width', 'height', 'sections'],
              },
              placeholders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    role: { type: Type.STRING },
                    section_id: { type: Type.STRING },
                    bounds: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                      },
                      required: ['x', 'y', 'width', 'height'],
                    },
                    content_hint: { type: Type.STRING },
                  },
                  required: ['id', 'type', 'role', 'section_id', 'bounds'],
                },
              },
            },
            required: ['layout', 'placeholders'],
          },
        },
      });

      if (!response.text) {
        throw new InternalServerErrorException(
          'Gemini returned empty text response',
        );
      }

      const parsedJson = JSON.parse(response.text) as unknown;

      // Validate against strict Zod backend schema
      const validated = AnalysisResultSchema.parse(parsedJson);
      return validated;
    } catch (err) {
      if (err instanceof Error) {
        throw new InternalServerErrorException(
          `Design Analysis Failed: ${err.message}`,
        );
      }
      throw new InternalServerErrorException(
        'Design Analysis Failed: Unknown error',
      );
    }
  }
}
