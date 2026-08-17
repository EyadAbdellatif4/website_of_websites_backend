export enum PreviewStatus {
  NOT_READY = 'NOT_READY',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  FAILED = 'FAILED',
}

export interface PreviewSession {
  designId: string;
  userId: string;
  generationId: string;
  port: number | null;
  url: string | null;
  status: PreviewStatus;
  startedAt: string | null;
  processId: number | null;
  errorMessage: string | null;
  logs: string[];
}

export interface ProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checkedFiles: string[];
  projectPath: string;
}

export interface PreviewStatusResponse {
  designId: string;
  status: PreviewStatus;
  url: string | null;
  port: number | null;
  startedAt: string | null;
  errorMessage: string | null;
  activePreviewsCount: number;
}
