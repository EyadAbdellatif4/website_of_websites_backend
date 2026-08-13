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
      this.configService.get<string>('gemini.apiKey') ||
      process.env.GEMINI_API_KEY;
    const modelName =
      this.configService.get<string>('gemini.model') ||
      process.env.GEMINI_MODEL ||
      'gemini-3-flash-preview';

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
File Inventory (Parsed Metadata):
${JSON.stringify(input.representation.fileInventory, null, 2)}

Please perform hybrid analysis and return the structured JSON layout and placeholders.
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
