import { XMLParser } from 'fast-xml-parser';

export interface SvgElementCounts {
  total: number;
  paths: number;
  rects: number;
  circles: number;
  groups: number;
  text: number;
  polygons: number;
  lines: number;
}

export interface ExtractedSvgText {
  text: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fill?: string;
  id?: string;
}

export interface SvgInspectionMetadata {
  width: string | number | null;
  height: string | number | null;
  viewBox: string | null;
  isSafe: boolean;
  securityWarnings: string[];
  elements: SvgElementCounts;
  extractedTexts?: ExtractedSvgText[];
  colorPalette?: string[];
  hasGradients?: boolean;
}

const DANGEROUS_PATTERNS = [
  { pattern: /<script[\s>]/i, name: 'Inline <script> tag detected' },
  { pattern: /on[a-z]+\s*=/i, name: 'Inline event handler attribute detected' },
  { pattern: /<foreignobject[\s>]/i, name: '<foreignObject> element detected' },
  { pattern: /<iframe[\s>]/i, name: '<iframe> element detected' },
  { pattern: /<embed[\s>]/i, name: '<embed> element detected' },
  { pattern: /<object[\s>]/i, name: '<object> element detected' },
  { pattern: /<!entity/i, name: 'XML entity definition (<!ENTITY) detected' },
  { pattern: /javascript\s*:/i, name: 'javascript: URI scheme detected' },
];

export class SvgInspector {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
  });

  inspect(svgContent: string): SvgInspectionMetadata {
    const securityWarnings = DANGEROUS_PATTERNS.filter((d) =>
      d.pattern.test(svgContent),
    ).map((d) => d.name);

    let width: string | number | null = null;
    let height: string | number | null = null;
    let viewBox: string | null = null;

    try {
      const parsed = this.parser.parse(svgContent) as Record<string, unknown>;
      const svgNode = (parsed.svg || parsed.SVG) as Record<string, unknown> | undefined;
      if (svgNode) {
        width = (svgNode['@_width'] as string | number) ?? null;
        height = (svgNode['@_height'] as string | number) ?? null;
        viewBox = ((svgNode['@_viewBox'] ?? svgNode['@_viewbox']) as string) ?? null;
      }
    } catch {
      securityWarnings.push('Malformed XML structure');
    }

    const counts: SvgElementCounts = {
      paths: (svgContent.match(/<path\b/gi) || []).length,
      rects: (svgContent.match(/<rect\b/gi) || []).length,
      circles: (svgContent.match(/<circle\b/gi) || []).length,
      groups: (svgContent.match(/<g\b/gi) || []).length,
      text: (svgContent.match(/<text\b/gi) || []).length,
      polygons: (svgContent.match(/<polygon\b/gi) || []).length,
      lines: (svgContent.match(/<line\b|<polyline\b/gi) || []).length,
      total: 0,
    };
    counts.total =
      counts.paths +
      counts.rects +
      counts.circles +
      counts.groups +
      counts.text +
      counts.polygons +
      counts.lines;

    const extractedTexts: ExtractedSvgText[] = [];
    const textRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
    let textMatch: RegExpExecArray | null;

    while ((textMatch = textRegex.exec(svgContent)) !== null && extractedTexts.length < 50) {
      const attrsStr = textMatch[1] || '';
      const cleanText = (textMatch[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanText) {
        const xMatch = attrsStr.match(/\bx=["']?([\d.-]+)/i);
        const yMatch = attrsStr.match(/\by=["']?([\d.-]+)/i);
        const fontMatch = attrsStr.match(/\bfont-size=["']?([\d.-]+)/i);
        const fillMatch = attrsStr.match(/\bfill=["']?([^"'\s>]+)/i);
        const idMatch = attrsStr.match(/\bid=["']?([^"'\s>]+)/i);

        extractedTexts.push({
          text: cleanText,
          x: xMatch ? parseFloat(xMatch[1]) : undefined,
          y: yMatch ? parseFloat(yMatch[1]) : undefined,
          fontSize: fontMatch ? parseFloat(fontMatch[1]) : undefined,
          fill: fillMatch ? fillMatch[1] : undefined,
          id: idMatch ? idMatch[1] : undefined,
        });
      }
    }

    const colorsFound = new Set<string>();
    const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/gi;
    let colorMatch: RegExpExecArray | null;
    while ((colorMatch = colorRegex.exec(svgContent)) !== null && colorsFound.size < 20) {
      colorsFound.add(colorMatch[1]);
    }

    return {
      width,
      height,
      viewBox,
      isSafe: securityWarnings.length === 0,
      securityWarnings,
      elements: counts,
      extractedTexts,
      colorPalette: Array.from(colorsFound),
      hasGradients: /<(linear|radial)Gradient\b/i.test(svgContent),
    };
  }
}
