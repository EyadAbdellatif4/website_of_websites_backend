export interface RenderedFile {
  relativePath: string;
  content: string | Buffer;
  isBinary?: boolean;
}

export interface CopiedAsset {
  originalStorageKey: string;
  destinationRelativePath: string; // e.g. public/assets/hero_1723891234.png
  publicUrlPath: string; // e.g. /assets/hero_1723891234.png
  fileName: string;
  size: number;
  mimeType: string;
}

export interface GenerationContext {
  designId: string;
  userId: string;
  designName: string;
  generationId: string;
  layout: {
    width: number;
    height: number;
    sections: Array<{
      id: string;
      type: string;
      order?: number;
      bounds: { x: number; y: number; width: number; height: number };
      styles?: {
        background_color?: string;
        text_color?: string;
        primary_color?: string;
        secondary_color?: string;
      };
    }>;
  };
  placeholders: Array<{
    id: string;
    type: string;
    role: string;
    section_id: string;
    bounds: { x: number; y: number; width: number; height: number };
    content_hint?: string;
    value?: unknown;
  }>;
  assets: CopiedAsset[];
}

export interface GeneratedProjectManifest {
  generationId: string;
  designId: string;
  userId: string;
  designName: string;
  generatedAt: string;
  projectTarget: 'Next.js App Router (TypeScript + Tailwind CSS)';
  totalFiles: number;
  sectionsCount: number;
  placeholdersCount: number;
  assetsCount: number;
  files: string[];
}

export interface GenerationResult {
  success: boolean;
  project: {
    generationId: string;
    designId: string;
    designName: string;
    status: 'GENERATED';
    generatedAt: string;
    totalFiles: number;
    manifest: GeneratedProjectManifest;
  };
}
