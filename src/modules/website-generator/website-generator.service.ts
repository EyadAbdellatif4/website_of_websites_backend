import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { DesignsService } from '../designs/designs.service';
import { TemplateRendererService } from './services/template-renderer.service';
import { AssetBundlerService } from './services/asset-bundler.service';
import {
  GenerationContext,
  GenerationResult,
  GeneratedProjectManifest,
} from './interfaces/generator.interface';

@Injectable()
export class WebsiteGeneratorService {
  private readonly generatedBaseDir: string;

  constructor(
    private readonly designsService: DesignsService,
    private readonly templateRenderer: TemplateRendererService,
    private readonly assetBundler: AssetBundlerService,
    private readonly configService: ConfigService,
  ) {
    const customStoragePath =
      this.configService.get<string>('FILE_STORAGE_PATH');
    this.generatedBaseDir = customStoragePath
      ? path.resolve(customStoragePath, 'generated')
      : path.resolve(process.cwd(), 'storage', 'generated');
  }

  /**
   * Generates a complete Next.js App Router website codebase from analyzed layout and placeholder data
   */
  async generateWebsite(
    designId: string,
    userId: string,
  ): Promise<GenerationResult> {
    // 1. Fetch and verify design ownership
    const design = await this.designsService.getDesignEntity(designId, userId);

    if (!design.layout_data || typeof design.layout_data !== 'object') {
      throw new BadRequestException(
        'Design does not have layout data. Run AI analysis before generating a website.',
      );
    }

    if (!design.placeholders_data || !Array.isArray(design.placeholders_data)) {
      throw new BadRequestException(
        'Design does not have placeholder data. Run AI analysis before generating a website.',
      );
    }

    const layoutData = design.layout_data as unknown as {
      width: number;
      height: number;
      sections: Array<{
        id: string;
        type: string;
        order?: number;
        bounds: { x: number; y: number; width: number; height: number };
      }>;
    };

    const placeholdersData = design.placeholders_data as unknown as Array<{
      id: string;
      type: string;
      role: string;
      section_id: string;
      bounds: { x: number; y: number; width: number; height: number };
      content_hint?: string;
      value?: unknown;
    }>;

    const generationId = crypto.randomUUID();
    const projectDir = path.join(
      this.generatedBaseDir,
      userId,
      designId,
      generationId,
    );

    // 2. Bundle placeholder assets
    const { assets, files: assetFiles } =
      await this.assetBundler.bundlePlaceholderAssets(placeholdersData);

    // 3. Build generation context
    const ctx: GenerationContext = {
      designId: design.id,
      userId,
      designName: design.name || 'Untitled Website',
      generationId,
      layout: {
        width: layoutData.width || 1440,
        height: layoutData.height || 2000,
        sections: layoutData.sections || [],
      },
      placeholders: placeholdersData,
      assets,
    };

    // 4. Render project code files
    const templateFiles = this.templateRenderer.renderProjectFiles(ctx);
    const allFiles = [...templateFiles, ...assetFiles];

    // 5. Write all files to disk
    try {
      await fs.mkdir(projectDir, { recursive: true });

      for (const file of allFiles) {
        const fullFilePath = path.join(projectDir, file.relativePath);
        await fs.mkdir(path.dirname(fullFilePath), { recursive: true });

        if (file.isBinary && Buffer.isBuffer(file.content)) {
          await fs.writeFile(fullFilePath, file.content);
        } else {
          await fs.writeFile(fullFilePath, String(file.content), 'utf-8');
        }
      }

      // 6. Write project manifest
      const manifest: GeneratedProjectManifest = {
        generationId,
        designId: design.id,
        userId,
        designName: design.name,
        generatedAt: new Date().toISOString(),
        projectTarget: 'Next.js App Router (TypeScript + Tailwind CSS)',
        totalFiles: allFiles.length,
        sectionsCount: ctx.layout.sections.length,
        placeholdersCount: ctx.placeholders.length,
        assetsCount: assets.length,
        files: allFiles.map((f) => f.relativePath),
      };

      await fs.writeFile(
        path.join(projectDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );

      return {
        success: true,
        project: {
          generationId,
          designId: design.id,
          designName: design.name,
          status: 'GENERATED',
          generatedAt: manifest.generatedAt,
          totalFiles: allFiles.length,
          manifest,
        },
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to generate website codebase: ${err instanceof Error ? err.message : 'Write error'}`,
      );
    }
  }

  /**
   * Retrieves the latest generation manifest for a design
   */
  async getLatestGenerationManifest(
    designId: string,
    userId: string,
  ): Promise<GeneratedProjectManifest | null> {
    // Verify design ownership
    await this.designsService.getDesignEntity(designId, userId);

    const designGenDir = path.join(this.generatedBaseDir, userId, designId);

    try {
      const genDirs = await fs.readdir(designGenDir);
      if (!genDirs || genDirs.length === 0) return null;

      // Find the most recently modified generation directory
      let latestGenId: string | null = null;
      let latestMtime = 0;

      for (const dirName of genDirs) {
        const manifestPath = path.join(designGenDir, dirName, 'manifest.json');
        try {
          const stat = await fs.stat(manifestPath);
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestGenId = dirName;
          }
        } catch {
          // skip invalid directory
        }
      }

      if (!latestGenId) return null;

      const manifestContent = await fs.readFile(
        path.join(designGenDir, latestGenId, 'manifest.json'),
        'utf-8',
      );
      return JSON.parse(manifestContent) as GeneratedProjectManifest;
    } catch {
      return null;
    }
  }

  /**
   * Compiles the generated project directory into a ZIP archive for client download
   */
  async getGeneratedProjectZip(
    designId: string,
    userId: string,
    generationId?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const design = await this.designsService.getDesignEntity(designId, userId);

    let targetGenId = generationId;
    if (!targetGenId) {
      const latest = await this.getLatestGenerationManifest(designId, userId);
      if (!latest) {
        throw new NotFoundException(
          'No generated website found for this design. Generate one first.',
        );
      }
      targetGenId = latest.generationId;
    }

    const projectDir = path.join(
      this.generatedBaseDir,
      userId,
      designId,
      targetGenId,
    );

    try {
      await fs.access(projectDir);
    } catch {
      throw new NotFoundException('Generated project directory not found.');
    }

    const zip = new AdmZip();
    zip.addLocalFolder(projectDir);
    const zipBuffer = zip.toBuffer();

    const sanitizedName =
      design.name.toLowerCase().replace(/[^a-z0-9-_]/g, '_') || 'website';

    return {
      buffer: zipBuffer,
      fileName: `${sanitizedName}_nextjs_website.zip`,
    };
  }
}
