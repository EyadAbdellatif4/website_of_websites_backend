import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { DesignsService } from '../designs/designs.service';
import { WebsiteGeneratorService } from '../website-generator/website-generator.service';
import { ProjectValidatorService } from './services/project-validator.service';
import {
  PREVIEW_MANAGER,
  type PreviewManager,
} from './services/preview-manager.interface';
import {
  PreviewStatus,
  PreviewStatusResponse,
} from './interfaces/preview.interface';

@Injectable()
export class WebsitePreviewService {
  private readonly generatedBaseDir: string;

  constructor(
    private readonly designsService: DesignsService,
    private readonly generatorService: WebsiteGeneratorService,
    private readonly validatorService: ProjectValidatorService,
    @Inject(PREVIEW_MANAGER)
    private readonly previewManager: PreviewManager,
    private readonly configService: ConfigService,
  ) {
    const customStoragePath =
      this.configService.get<string>('FILE_STORAGE_PATH');
    this.generatedBaseDir = customStoragePath
      ? path.resolve(customStoragePath, 'generated')
      : path.resolve(process.cwd(), 'storage', 'generated');
  }

  /**
   * Validates and starts an isolated preview instance for a generated website
   */
  async startPreview(
    designId: string,
    userId: string,
  ): Promise<PreviewStatusResponse> {
    // 1. Verify design ownership
    await this.designsService.getDesignEntity(designId, userId);

    // 2. Fetch latest generation manifest
    const manifest = await this.generatorService.getLatestGenerationManifest(
      designId,
      userId,
    );

    if (!manifest) {
      throw new BadRequestException(
        'Website has not been generated yet. Please generate the website before previewing.',
      );
    }

    const projectPath = path.join(
      this.generatedBaseDir,
      userId,
      designId,
      manifest.generationId,
    );

    // 3. Validate generated project files before starting
    const validation = await this.validatorService.validateProject(projectPath);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Generated project failed validation: ${validation.errors.join('; ')}`,
      );
    }

    // 4. Start preview through PreviewManager
    const session = await this.previewManager.startPreview(
      designId,
      userId,
      manifest.generationId,
      projectPath,
    );

    return {
      designId,
      status: session.status,
      url: session.url,
      port: session.port,
      startedAt: session.startedAt,
      errorMessage: session.errorMessage,
      activePreviewsCount: this.previewManager.getActiveSessionsCount(),
    };
  }

  /**
   * Retrieves current preview status for a design
   */
  async getPreviewStatus(
    designId: string,
    userId: string,
  ): Promise<PreviewStatusResponse> {
    await this.designsService.getDesignEntity(designId, userId);

    const activeSession = await this.previewManager.getPreviewSession(
      designId,
      userId,
    );

    if (activeSession) {
      return {
        designId,
        status: activeSession.status,
        url: activeSession.url,
        port: activeSession.port,
        startedAt: activeSession.startedAt,
        errorMessage: activeSession.errorMessage,
        activePreviewsCount: this.previewManager.getActiveSessionsCount(),
      };
    }

    const manifest = await this.generatorService.getLatestGenerationManifest(
      designId,
      userId,
    );

    return {
      designId,
      status: manifest ? PreviewStatus.STOPPED : PreviewStatus.NOT_READY,
      url: null,
      port: null,
      startedAt: null,
      errorMessage: null,
      activePreviewsCount: this.previewManager.getActiveSessionsCount(),
    };
  }

  /**
   * Stops an active preview instance
   */
  async stopPreview(
    designId: string,
    userId: string,
  ): Promise<PreviewStatusResponse> {
    await this.designsService.getDesignEntity(designId, userId);

    const stoppedSession = await this.previewManager.stopPreview(
      designId,
      userId,
    );

    return {
      designId,
      status: stoppedSession.status,
      url: null,
      port: null,
      startedAt: null,
      errorMessage: null,
      activePreviewsCount: this.previewManager.getActiveSessionsCount(),
    };
  }
}
