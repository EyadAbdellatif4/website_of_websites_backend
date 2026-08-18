import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DesignProcessingService } from './design-processing.service';
import { SvgInspector } from './inspectors/svg.inspector';
import { ImageInspector } from './inspectors/image.inspector';
import { FontInspector } from './inspectors/font.inspector';
import { ZipProcessor } from '../../common/utils/zip.util';
import { DesignsService } from '../designs/designs.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { FileStorageService } from '../file-storage/file-storage.service';

describe('DesignProcessingModule (Security, Inspection & Status Lifecycle)', () => {
  let sequelize: Sequelize;
  let processingService: DesignProcessingService;
  let designsService: DesignsService;
  let testUserA: User;
  let testUserB: User;
  const tempStorageDir = path.resolve('./storage_test_processing');

  // Valid 1x1 PNG Buffer
  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xd5, 0xc4, 0xcb,
  ]);

  const createSampleZipBuffer = (): Buffer => {
    const zip = new AdmZip();

    const sampleSvg = `
      <svg width="1440" height="900" viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg">
        <g id="hero">
          <rect width="1440" height="900" fill="#000000"/>
          <circle cx="720" cy="450" r="100"/>
          <path d="M10 10 H 90 V 90 H 10 Z"/>
          <text x="100" y="100">Welcome</text>
        </g>
      </svg>
    `;

    // Dummy WOFF2 font buffer
    const sampleFontBuffer = Buffer.from('wOF2dummyfontcontentdata');

    zip.addFile('homepage.svg', Buffer.from(sampleSvg, 'utf-8'));
    zip.addFile('assets/hero.png', samplePngBuffer);
    zip.addFile('fonts/Inter.woff2', sampleFontBuffer);
    zip.addFile('scripts/malicious.js', Buffer.from('console.log("bad");'));

    return zip.toBuffer();
  };

  beforeAll(async () => {
    process.env.FILE_STORAGE_PATH = tempStorageDir;

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
        }),
      ],
      providers: [
        DesignProcessingService,
        DesignsService,
        FileStorageService,
        {
          provide: 'DesignRepository',
          useValue: Design,
        },
      ],
    }).compile();

    processingService = moduleRef.get<DesignProcessingService>(
      DesignProcessingService,
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

    testUserA = await User.create({
      email: 'usera_proc@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'userb_proc@example.com',
      password_hash: 'hashB',
    });
  });

  describe('SVG INSPECTION & SECURITY SANITIZATION', () => {
    const inspector = new SvgInspector();

    it('should extract width, height, viewBox, and element counts for valid SVG', () => {
      const validSvg = `
        <svg width="800" height="600" viewBox="0 0 800 600">
          <g>
            <rect width="100" height="100" />
            <circle cx="50" cy="50" r="20" />
            <path d="M 0 0 L 10 10" />
            <text>Header</text>
          </g>
        </svg>
      `;

      const result = inspector.inspect(validSvg);

      expect(result.width).toBe('800');
      expect(result.height).toBe('600');
      expect(result.viewBox).toBe('0 0 800 600');
      expect(result.isSafe).toBe(true);
      expect(result.securityWarnings.length).toBe(0);
      expect(result.elements.rects).toBe(1);
      expect(result.elements.circles).toBe(1);
      expect(result.elements.paths).toBe(1);
      expect(result.elements.text).toBe(1);
      expect(result.elements.groups).toBe(1);
    });

    it('should detect inline <script> tags and onload handlers as unsafe', () => {
      const maliciousSvg = `
        <svg width="100" height="100" onload="alert('xss')">
          <script>console.log('malicious execution');</script>
          <rect width="10" height="10" />
        </svg>
      `;

      const result = inspector.inspect(maliciousSvg);

      expect(result.isSafe).toBe(false);
      expect(result.securityWarnings).toContain('Inline <script> tag detected');
      expect(result.securityWarnings).toContain(
        'Inline event handler attribute detected',
      );
    });

    it('should detect <iframe> and XML entity expansion as unsafe', () => {
      const dangerousSvg = `
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
        <svg width="100" height="100">
          <iframe src="https://evil.com"></iframe>
        </svg>
      `;

      const result = inspector.inspect(dangerousSvg);

      expect(result.isSafe).toBe(false);
      expect(result.securityWarnings).toContain('<iframe> element detected');
      expect(result.securityWarnings).toContain(
        'XML entity definition (<!ENTITY) detected',
      );
    });
  });

  describe('IMAGE & FONT INSPECTION', () => {
    it('should inspect 1x1 PNG image metadata correctly', () => {
      const imgInspector = new ImageInspector();
      const result = imgInspector.inspect(samplePngBuffer, 'hero.png');

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.format).toBe('png');
      expect(result.corrupted).toBe(false);
    });

    it('should handle corrupted image buffer safely without throwing exception', () => {
      const imgInspector = new ImageInspector();
      const corruptedBuffer = Buffer.from('Not a real image file');

      const result = imgInspector.inspect(corruptedBuffer, 'corrupted.jpg');

      expect(result.corrupted).toBe(true);
      expect(result.format).toBe('jpg');
    });

    it('should inspect font file format and size', () => {
      const fontInspector = new FontInspector();
      const result = fontInspector.inspect(
        Buffer.from('fontbytes'),
        'Inter-Bold.woff2',
      );

      expect(result.filename).toBe('Inter-Bold.woff2');
      expect(result.format).toBe('woff2');
      expect(result.size).toBe(9);
    });
  });

  describe('ZIP PROCESSOR EXTRACTION', () => {
    const processor = new ZipProcessor();

    it('should ignore entries attempting path traversal or starting with slashes', () => {
      const zip = new AdmZip();
      zip.addFile('valid.svg', Buffer.from('<svg></svg>'));
      zip.addFile('placeholder.txt', Buffer.from('escape attempt'));
      const entries = zip.getEntries();
      entries[1].entryName = '../../evil.txt';
      const zipBuf = zip.toBuffer();

      const extracted = processor.process(zipBuf);
      expect(extracted.length).toBe(1);
      expect(extracted[0].entryPath).toBe('valid.svg');
    });

    it('should throw BadRequestException on corrupted ZIP buffer', () => {
      expect(() => processor.process(Buffer.from('not a zip'))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('FULL PROCESSING PIPELINE & STATUS LIFECYCLE', () => {
    let mockMulterFile: Express.Multer.File;

    beforeEach(() => {
      const zipBuf = createSampleZipBuffer();
      mockMulterFile = {
        fieldname: 'file',
        originalname: 'valid-design.zip',
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: zipBuf,
        size: zipBuf.length,
      } as unknown as Express.Multer.File;
    });

    it('should transition status from UPLOADED -> PROCESSING -> READY and generate normalized representation', async () => {
      const design = await processingService.upload(
        testUserA,
        mockMulterFile,
        'Pipeline Test Design',
      );
      expect(design.status).toBe(DesignStatus.UPLOADED);

      const representation = await processingService.processDesign(
        design.id,
        testUserA.id,
      );

      expect(representation.designId).toBe(design.id);
      expect(representation.summary.totalFiles).toBe(3); // svg, image, font (script file ignored)
      expect(representation.summary.svgCount).toBe(1);
      expect(representation.summary.imageCount).toBe(1);
      expect(representation.summary.fontCount).toBe(1);

      // Verify status updated to READY
      const updatedDesign = await designsService.findOneForUser(
        design.id,
        testUserA.id,
      );
      expect(updatedDesign.status).toBe(DesignStatus.READY);

      // Verify result query
      const result = await processingService.getProcessingResult(
        design.id,
        testUserA.id,
      );
      expect(result.summary.totalFiles).toBe(3);
    });

    it('should NOT allow User B to process User A design', async () => {
      const design = await processingService.upload(
        testUserA,
        mockMulterFile,
        'User A Design',
      );

      await expect(
        processingService.processDesign(design.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent concurrent processing if design is already PROCESSING', async () => {
      const design = await processingService.upload(
        testUserA,
        mockMulterFile,
        'Concurrent Test',
      );

      // Manually set status to PROCESSING
      await designsService.updateStatus(
        design.id,
        testUserA.id,
        DesignStatus.PROCESSING,
      );

      await expect(
        processingService.processDesign(design.id, testUserA.id),
      ).rejects.toThrow(ConflictException);
    });
  });
});
