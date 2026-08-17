import { PreviewSession } from '../interfaces/preview.interface';

export const PREVIEW_MANAGER = 'PREVIEW_MANAGER';

export interface PreviewManager {
  startPreview(
    designId: string,
    userId: string,
    generationId: string,
    projectPath: string,
  ): Promise<PreviewSession>;

  stopPreview(designId: string, userId: string): Promise<PreviewSession>;

  getPreviewSession(
    designId: string,
    userId: string,
  ): Promise<PreviewSession | null>;

  getActiveSessionsCount(): number;

  cleanupAll(): Promise<void>;
}
