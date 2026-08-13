import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DesignAnalysisService } from './design-analysis.service';
import { MockDesignAnalyzer } from './providers/mock-design-analyzer.provider';
import { DESIGN_ANALYZER_PROVIDER } from './interfaces/design-analyzer.interface';
import { DesignsService } from '../designs/designs.service';
import { DesignProcessingService } from '../design-processing/design-processing.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { LocalFileStorageService } from '../file-storage/local-file-storage.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import envConfig from '../../config/env.config';

describe('DesignAnalysisModule (Mocked AI Provider & Schema Validation Tests)', () => {
  let sequelize: Sequelize;
  let analysisService: DesignAnalysisService;
  let designsService: DesignsService;
  let mockAnalyzer: MockDesignAnalyzer;
  let testUserA: User;
  let testUserB: User;
  const tempStorageDir = path.resolve('./storage_test_analysis');

  const createSampleZip = (): Buffer => {
    const zip = new AdmZip();
    zip.addFile(
      'homepage.svg',
      Buffer.from('<svg width="1440" height="900"><rect/></svg>', 'utf-8'),
    );
    return zip.toBuffer();
  };

  beforeAll(async () => {
    process.env.FILE_STORAGE_PATH = tempStorageDir;
    process.env.USE_MOCK_ANALYZER = 'true';

    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      models: [User, Design],
    });
    await sequelize.sync({ force: true });

    mockAnalyzer = new MockDesignAnalyzer();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [envConfig],
        }),
      ],
      providers: [
        DesignAnalysisService,
        DesignsService,
        DesignProcessingService,
        {
          provide: DESIGN_ANALYZER_PROVIDER,
          useValue: mockAnalyzer,
        },
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

    analysisService = moduleRef.get<DesignAnalysisService>(
      DesignAnalysisService,
    );
    designsService = moduleRef.get<DesignsService>(DesignsService);
  });

  afterAll(async () => {
    await sequelize.close();
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  beforeEach(async () => {
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    mockAnalyzer.shouldFail = false;
    mockAnalyzer.mockResponseOverride = null;

    testUserA = await User.create({
      email: 'usera_analysis@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'userb_analysis@example.com',
      password_hash: 'hashB',
    });
  });

  describe('AI DESIGN ANALYSIS & PERSISTENCE', () => {
    it('should analyze design using MockDesignAnalyzer and save layout_data and placeholders_data to DB', async () => {
      const zipBuffer = createSampleZip();
      const mockFile = {
        fieldname: 'file',
        originalname: 'design.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuffer,
        size: zipBuffer.length,
      } as unknown as Express.Multer.File;

      const design = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'Landing Page Design',
      );

      const analysisRes = await analysisService.analyzeDesign(
        design.id,
        testUserA.id,
      );

      expect(analysisRes.design.id).toBe(design.id);
      expect(analysisRes.result.layout.width).toBe(1440);
      expect(analysisRes.result.layout.sections.length).toBeGreaterThan(0);
      expect(analysisRes.result.placeholders.length).toBeGreaterThan(0);

      // Verify stored DB columns
      const updatedEntity = await designsService.getDesignEntity(
        design.id,
        testUserA.id,
      );
      expect(updatedEntity.layout_data).toBeDefined();
      expect(updatedEntity.placeholders_data).toBeDefined();
      expect(updatedEntity.status).toBe(DesignStatus.READY);

      // Query via getAnalysisResult
      const getRes = await analysisService.getAnalysisResult(
        design.id,
        testUserA.id,
      );
      expect(getRes.result.layout.width).toBe(1440);
    });

    it('should NOT allow User B to analyze User A design', async () => {
      const zipBuffer = createSampleZip();
      const mockFile = {
        fieldname: 'file',
        originalname: 'design.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuffer,
        size: zipBuffer.length,
      } as unknown as Express.Multer.File;

      const design = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'User A Design',
      );

      await expect(
        analysisService.analyzeDesign(design.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SCHEMA VALIDATION & FAILURE DATA PRESERVATION', () => {
    it('should reject malformed AI response violating Zod schema and NOT corrupt DB', async () => {
      const zipBuffer = createSampleZip();
      const mockFile = {
        fieldname: 'file',
        originalname: 'design.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuffer,
        size: zipBuffer.length,
      } as unknown as Express.Multer.File;

      const design = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'Preservation Test Design',
      );

      // First successful run
      await analysisService.analyzeDesign(design.id, testUserA.id);

      const beforeFailEntity = await designsService.getDesignEntity(
        design.id,
        testUserA.id,
      );
      const originalLayout = beforeFailEntity.layout_data;

      // Force mock analyzer to fail
      mockAnalyzer.shouldFail = true;

      await expect(
        analysisService.analyzeDesign(design.id, testUserA.id),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify original DB data remains untouched and uncorrupted
      const afterFailEntity = await designsService.getDesignEntity(
        design.id,
        testUserA.id,
      );
      expect(afterFailEntity.layout_data).toEqual(originalLayout);
    });
  });

  describe('STATUS PREREQUISITE VALIDATION', () => {
    it('should reject analysis if design status is FAILED', async () => {
      const zipBuffer = createSampleZip();
      const mockFile = {
        fieldname: 'file',
        originalname: 'design.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuffer,
        size: zipBuffer.length,
      } as unknown as Express.Multer.File;

      const design = await designsService.uploadDesign(
        testUserA,
        mockFile,
        'Failed Status Design',
      );
      await designsService.updateStatus(
        design.id,
        testUserA.id,
        DesignStatus.FAILED,
      );

      await expect(
        analysisService.analyzeDesign(design.id, testUserA.id),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
