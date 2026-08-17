import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WebsitePreviewService } from './website-preview.service';
import { ProjectValidatorService } from './services/project-validator.service';
import { PortManagerService } from './services/port-manager.service';
import { LocalPreviewManagerService } from './services/local-preview-manager.service';
import { PREVIEW_MANAGER } from './services/preview-manager.interface';
import { PreviewStatus } from './interfaces/preview.interface';
import { WebsiteGeneratorService } from '../website-generator/website-generator.service';
import { TemplateRendererService } from '../website-generator/services/template-renderer.service';
import { AssetBundlerService } from '../website-generator/services/asset-bundler.service';
import { DesignsService } from '../designs/designs.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { LocalFileStorageService } from '../file-storage/local-file-storage.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import envConfig from '../../config/env.config';

describe('WebsitePreviewService (Preview Engine & Validation Tests)', () => {
  let sequelize: Sequelize;
  let previewService: WebsitePreviewService;
  let generatorService: WebsiteGeneratorService;
  let validatorService: ProjectValidatorService;
  let portManager: PortManagerService;
  let previewManager: LocalPreviewManagerService;
  let designsService: DesignsService;
  let testUserA: User;
  let testUserB: User;
  let sampleDesign: Design;
  const tempStorageDir = path.resolve('./storage_test_preview');

  const createSampleZip = (): Buffer => {
    const zip = new AdmZip();
    zip.addFile(
      'index.svg',
      Buffer.from('<svg><text>Hi</text></svg>', 'utf-8'),
    );
    return zip.toBuffer();
  };

  beforeAll(async () => {
    process.env.FILE_STORAGE_PATH = tempStorageDir;
    process.env.PREVIEW_PORT_START = '3200';
    process.env.PREVIEW_PORT_END = '3220';
    process.env.MAX_ACTIVE_PREVIEWS = '2';

    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      models: [User, Design],
    });
    await sequelize.sync({ force: true });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [envConfig],
        }),
      ],
      providers: [
        WebsitePreviewService,
        ProjectValidatorService,
        PortManagerService,
        LocalPreviewManagerService,
        {
          provide: PREVIEW_MANAGER,
          useExisting: LocalPreviewManagerService,
        },
        WebsiteGeneratorService,
        TemplateRendererService,
        AssetBundlerService,
        DesignsService,
        {
          provide: FILE_STORAGE_SERVICE,
          useClass: LocalFileStorageService,
        },
        {
          provide: 'DesignRepository',
          useValue: Design,
        },
      ],
    }).compile();

    previewService = moduleRef.get<WebsitePreviewService>(
      WebsitePreviewService,
    );
    generatorService = moduleRef.get<WebsiteGeneratorService>(
      WebsiteGeneratorService,
    );
    validatorService = moduleRef.get<ProjectValidatorService>(
      ProjectValidatorService,
    );
    portManager = moduleRef.get<PortManagerService>(PortManagerService);
    previewManager = moduleRef.get<LocalPreviewManagerService>(
      LocalPreviewManagerService,
    );
    designsService = moduleRef.get<DesignsService>(DesignsService);
  });

  afterAll(async () => {
    await previewManager.cleanupAll();
    await sequelize.close();
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });

  beforeEach(async () => {
    await previewManager.cleanupAll();
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    testUserA = await User.create({
      email: 'creator_preview@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'attacker_preview@example.com',
      password_hash: 'hashB',
    });

    const zipBuffer = createSampleZip();
    const mockFile = {
      fieldname: 'file',
      originalname: 'design.zip',
      encoding: '7bit',
      mimetype: 'application/zip',
      buffer: zipBuffer,
      size: zipBuffer.length,
    } as unknown as Express.Multer.File;

    const safeDto = await designsService.uploadDesign(
      testUserA,
      mockFile,
      'Seaside Boutique Villa',
    );

    sampleDesign = await designsService.getDesignEntity(
      safeDto.id,
      testUserA.id,
    );

    sampleDesign.layout_data = {
      width: 1440,
      height: 1800,
      sections: [
        {
          id: 'sec_header',
          type: 'header',
          bounds: { x: 0, y: 0, width: 1440, height: 80 },
        },
        {
          id: 'sec_hero',
          type: 'hero',
          bounds: { x: 0, y: 80, width: 1440, height: 600 },
        },
        {
          id: 'sec_footer',
          type: 'footer',
          bounds: { x: 0, y: 680, width: 1440, height: 120 },
        },
      ],
    };

    sampleDesign.placeholders_data = [
      {
        id: 'ph_hero_title',
        type: 'text',
        role: 'hero_heading',
        section_id: 'sec_hero',
        bounds: { x: 100, y: 150, width: 600, height: 100 },
        value: 'Exclusive Seaside Retreat',
      },
    ];
    sampleDesign.status = DesignStatus.READY;
    await sampleDesign.save();
  });

  describe('1. PROJECT VALIDATOR SERVICE', () => {
    it('should validate complete generated Next.js project successfully', async () => {
      const genResult = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        genResult.project.generationId,
      );

      const validation = await validatorService.validateProject(projectPath);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.checkedFiles).toContain('package.json');
      expect(validation.checkedFiles).toContain('app/layout.tsx');
      expect(validation.checkedFiles).toContain('app/page.tsx');
    });

    it('should fail validation when package.json is missing or corrupted', async () => {
      const genResult = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        genResult.project.generationId,
      );

      // Corrupt package.json
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        '{ broken json',
        'utf-8',
      );

      const validation = await validatorService.validateProject(projectPath);
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('package.json');
    });
  });

  describe('2. PORT MANAGER SERVICE', () => {
    it('should allocate ports sequentially and release back to pool', async () => {
      const port1 = await portManager.allocatePort();
      const port2 = await portManager.allocatePort();

      expect(port1).toBeGreaterThanOrEqual(3200);
      expect(port2).toBe(port1 + 1);

      portManager.releasePort(port1);
      const portReallocated = await portManager.allocatePort();
      expect(portReallocated).toBe(port1);

      portManager.releasePort(port2);
      portManager.releasePort(portReallocated);
    });
  });

  describe('3. PREVIEW LIFECYCLE & SERVER', () => {
    it('should start preview server, return status RUNNING with URL, and stop gracefully', async () => {
      // 1. Generate project first
      await generatorService.generateWebsite(sampleDesign.id, testUserA.id);

      // 2. Start preview
      const startRes = await previewService.startPreview(
        sampleDesign.id,
        testUserA.id,
      );

      expect(startRes.status).toBe(PreviewStatus.RUNNING);
      expect(startRes.port).toBeGreaterThanOrEqual(3200);
      expect(startRes.url).toBe(`http://localhost:${startRes.port}`);
      expect(startRes.activePreviewsCount).toBe(1);

      // 3. Get status
      const statusRes = await previewService.getPreviewStatus(
        sampleDesign.id,
        testUserA.id,
      );
      expect(statusRes.status).toBe(PreviewStatus.RUNNING);
      expect(statusRes.port).toBe(startRes.port);

      // 4. Stop preview
      const stopRes = await previewService.stopPreview(
        sampleDesign.id,
        testUserA.id,
      );
      expect(stopRes.status).toBe(PreviewStatus.STOPPED);
      expect(stopRes.url).toBeNull();

      // 5. Verify status after stop
      const finalStatus = await previewService.getPreviewStatus(
        sampleDesign.id,
        testUserA.id,
      );
      expect(finalStatus.status).toBe(PreviewStatus.STOPPED);
    });

    it('should reject preview start if design has not been generated yet', async () => {
      await expect(
        previewService.startPreview(sampleDesign.id, testUserA.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. SECURITY & CONCURRENCY CONTROLS', () => {
    it('should NOT allow User B to preview User A design', async () => {
      await generatorService.generateWebsite(sampleDesign.id, testUserA.id);

      await expect(
        previewService.startPreview(sampleDesign.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce MAX_ACTIVE_PREVIEWS limit', async () => {
      // Create second design for User A
      const zipBuffer = createSampleZip();
      const mockFile = {
        fieldname: 'file',
        originalname: 'design2.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuffer,
        size: zipBuffer.length,
      } as unknown as Express.Multer.File;

      const design2Dto = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'Design Two',
      );
      const design2 = await designsService.getDesignEntity(
        design2Dto.id,
        testUserA.id,
      );
      design2.layout_data = sampleDesign.layout_data;
      design2.placeholders_data = sampleDesign.placeholders_data;
      design2.status = DesignStatus.READY;
      await design2.save();

      // Create third design for User A
      const design3Dto = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'Design Three',
      );
      const design3 = await designsService.getDesignEntity(
        design3Dto.id,
        testUserA.id,
      );
      design3.layout_data = sampleDesign.layout_data;
      design3.placeholders_data = sampleDesign.placeholders_data;
      design3.status = DesignStatus.READY;
      await design3.save();

      // Generate all 3 designs
      await generatorService.generateWebsite(sampleDesign.id, testUserA.id);
      await generatorService.generateWebsite(design2.id, testUserA.id);
      await generatorService.generateWebsite(design3.id, testUserA.id);

      // Start 2 previews (MAX_ACTIVE_PREVIEWS = 2)
      await previewService.startPreview(sampleDesign.id, testUserA.id);
      await previewService.startPreview(design2.id, testUserA.id);

      // 3rd preview attempt must throw BadRequestException
      await expect(
        previewService.startPreview(design3.id, testUserA.id),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
