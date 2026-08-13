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

export interface SvgInspectionMetadata {
  width: string | number | null;
  height: string | number | null;
  viewBox: string | null;
  isSafe: boolean;
  securityWarnings: string[];
  elements: SvgElementCounts;
}

const DANGEROUS_CONSTRUCT_PATTERNS = [
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
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: false,
      processEntities: false, // Prevent XML Entity Expansion (XXE)
    });
  }

  inspect(svgContent: string): SvgInspectionMetadata {
    const warnings: string[] = [];

    // 1. Security scan
    for (const { pattern, name } of DANGEROUS_CONSTRUCT_PATTERNS) {
      if (pattern.test(svgContent)) {
        warnings.push(name);
      }
    }

    const isSafe = warnings.length === 0;

    // 2. Structural XML parse
    let width: string | number | null = null;
    let height: string | number | null = null;
    let viewBox: string | null = null;

    const counts: SvgElementCounts = {
      total: 0,
      paths: 0,
      rects: 0,
      circles: 0,
      groups: 0,
      text: 0,
      polygons: 0,
      lines: 0,
    };

    try {
      const parsed = this.parser.parse(svgContent) as Record<string, unknown>;
      const svgNode = (parsed.svg || parsed.SVG) as
        Record<string, unknown> | undefined;

      if (svgNode) {
        width = (svgNode['@_width'] as string | number) ?? null;
        height = (svgNode['@_height'] as string | number) ?? null;
        viewBox =
          (svgNode['@_viewBox'] as string) ??
          (svgNode['@_viewbox'] as string) ??
          null;

        this.countNodes(svgNode, counts);
      }
    } catch {
      warnings.push('Malformed XML structure');
    }

    return {
      width,
      height,
      viewBox,
      isSafe,
      securityWarnings: warnings,
      elements: counts,
    };
  }

  private countNodes(node: unknown, counts: SvgElementCounts): void {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) {
        this.countNodes(item, counts);
      }
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('@_')) continue;

      const lowerKey = key.toLowerCase();
      const val = obj[key];
      const itemCount = Array.isArray(val) ? val.length : 1;

      if (lowerKey === 'path') counts.paths += itemCount;
      else if (lowerKey === 'rect') counts.rects += itemCount;
      else if (lowerKey === 'circle') counts.circles += itemCount;
      else if (lowerKey === 'g') counts.groups += itemCount;
      else if (lowerKey === 'text' || lowerKey === 'tspan')
        counts.text += itemCount;
      else if (lowerKey === 'polygon') counts.polygons += itemCount;
      else if (lowerKey === 'line' || lowerKey === 'polyline')
        counts.lines += itemCount;

      counts.total += itemCount;

      if (typeof val === 'object' && val !== null) {
        this.countNodes(val, counts);
      }
    }
  }
}
