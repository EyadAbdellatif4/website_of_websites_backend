import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PlaceholdersService } from './placeholders.service';
import { DesignsService } from '../designs/designs.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { LocalFileStorageService } from '../file-storage/local-file-storage.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import envConfig from '../../config/env.config';

describe('PlaceholdersService (Content Editor & Isolation Tests)', () => {
  let sequelize: Sequelize;
  let placeholdersService: PlaceholdersService;
  let designsService: DesignsService;
  let testUserA: User;
  let testUserB: User;
  let sampleDesign: Design;
  const tempStorageDir = path.resolve('./storage_test_placeholders');

  const createSampleZip = (): Buffer => {
    const zip = new AdmZip();
    zip.addFile(
      'index.svg',
      Buffer.from('<svg><text>Hi</text></svg>', 'utf-8'),
    );
    return zip.toBuffer();
  };

  // Sample 1x1 PNG buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

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
          load: [envConfig],
        }),
      ],
      providers: [
        PlaceholdersService,
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

    placeholdersService = moduleRef.get<PlaceholdersService>(
      PlaceholdersService,
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
      email: 'usera_placeholders@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'userb_placeholders@example.com',
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
      'Placeholders Test Design',
    );

    sampleDesign = await designsService.getDesignEntity(
      safeDto.id,
      testUserA.id,
    );

    // Seed placeholders_data directly on design
    sampleDesign.layout_data = {
      width: 1440,
      height: 2000,
      sections: [
        {
          id: 'sec_hero',
          type: 'hero',
          bounds: { x: 0, y: 0, width: 1440, height: 600 },
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
        content_hint: 'Default Title',
        value: null,
      },
      {
        id: 'ph_hero_img',
        type: 'image',
        role: 'hero_image',
        section_id: 'sec_hero',
        bounds: { x: 800, y: 100, width: 500, height: 400 },
        value: null,
      },
      {
        id: 'ph_cta_btn',
        type: 'button',
        role: 'cta_button',
        section_id: 'sec_hero',
        bounds: { x: 100, y: 300, width: 180, height: 50 },
        value: null,
      },
      {
        id: 'ph_nav_link',
        type: 'link',
        role: 'nav_link',
        section_id: 'sec_hero',
        bounds: { x: 800, y: 30, width: 80, height: 20 },
        value: null,
      },
    ];
    sampleDesign.status = DesignStatus.READY;
    await sampleDesign.save();
  });

  describe('1. TEXT PLACEHOLDERS', () => {
    it('should save valid text content and update filled count', async () => {
      const res = await placeholdersService.updatePlaceholderValue(
        sampleDesign.id,
        'ph_hero_title',
        testUserA.id,
        'Welcome to our Luxury Resort',
      );

      expect(res.placeholder.id).toBe('ph_hero_title');
      expect(res.placeholder.value).toBe('Welcome to our Luxury Resort');
      expect(res.totalFilled).toBe(1);
      expect(res.totalCount).toBe(4);

      // Verify atomic persistence: other placeholders untouched
      const fetched = await placeholdersService.getPlaceholders(
        sampleDesign.id,
        testUserA.id,
      );
      const titlePh = fetched.find((p) => p.id === 'ph_hero_title');
      const imgPh = fetched.find((p) => p.id === 'ph_hero_img');
      expect(titlePh?.value).toBe('Welcome to our Luxury Resort');
      expect(imgPh?.value).toBeNull();
    });

    it('should reject non-string values for text placeholders', async () => {
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'ph_hero_title',
          testUserA.id,
          12345,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject text exceeding maximum character limit', async () => {
      const hugeText = 'A'.repeat(10001);
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'ph_hero_title',
          testUserA.id,
          hugeText,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. BUTTON & LINK PLACEHOLDERS', () => {
    it('should save valid button with relative URL', async () => {
      const res = await placeholdersService.updatePlaceholderValue(
        sampleDesign.id,
        'ph_cta_btn',
        testUserA.id,
        { text: 'Book Now', url: '/booking' },
      );

      expect(res.placeholder.value).toEqual({
        text: 'Book Now',
        url: '/booking',
      });
    });

    it('should save valid link with https URL', async () => {
      const res = await placeholdersService.updatePlaceholderValue(
        sampleDesign.id,
        'ph_nav_link',
        testUserA.id,
        { text: 'Documentation', url: 'https://example.com/docs' },
      );

      expect(res.placeholder.value).toEqual({
        text: 'Documentation',
        url: 'https://example.com/docs',
      });
    });

    it('should reject dangerous javascript: scheme in button URL', async () => {
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'ph_cta_btn',
          testUserA.id,
          { text: 'Attack', url: 'javascript:alert(document.cookie)' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject dangerous data: scheme in link URL', async () => {
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'ph_nav_link',
          testUserA.id,
          { text: 'Exploit', url: 'data:text/html,<script>alert(1)</script>' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. IMAGE PLACEHOLDER UPLOADS & ISOLATION', () => {
    it('should upload valid PNG image and store dimensions and metadata', async () => {
      const mockImageFile = {
        fieldname: 'file',
        originalname: 'hotel-hero.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: samplePngBuffer,
        size: samplePngBuffer.length,
      } as unknown as Express.Multer.File;

      const res = await placeholdersService.uploadPlaceholderImage(
        sampleDesign.id,
        'ph_hero_img',
        testUserA.id,
        mockImageFile,
      );

      expect(res.placeholder.id).toBe('ph_hero_img');
      const val = res.placeholder.value as {
        storage_key: string;
        file_name: string;
        mime_type: string;
      };
      expect(val.storage_key).toContain(
        `designs/${testUserA.id}/${sampleDesign.id}/content/ph_hero_img/`,
      );
      expect(val.file_name).toBe('hotel-hero.png');
      expect(val.mime_type).toBe('image/png');

      // Verify retrieval stream
      const streamRes = await placeholdersService.getPlaceholderImageFile(
        sampleDesign.id,
        'ph_hero_img',
        testUserA.id,
      );
      expect(streamRes.buffer.length).toBe(samplePngBuffer.length);
      expect(streamRes.mimeType).toBe('image/png');
    });

    it('should reject non-image files (e.g. .exe / text)', async () => {
      const mockExeFile = {
        fieldname: 'file',
        originalname: 'malware.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        buffer: Buffer.from('executable binary'),
        size: 17,
      } as unknown as Express.Multer.File;

      await expect(
        placeholdersService.uploadPlaceholderImage(
          sampleDesign.id,
          'ph_hero_img',
          testUserA.id,
          mockExeFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject image uploads to non-image placeholders', async () => {
      const mockImageFile = {
        fieldname: 'file',
        originalname: 'hero.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: samplePngBuffer,
        size: samplePngBuffer.length,
      } as unknown as Express.Multer.File;

      await expect(
        placeholdersService.uploadPlaceholderImage(
          sampleDesign.id,
          'ph_hero_title', // text type!
          testUserA.id,
          mockImageFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. OWNERSHIP & INTEGRITY CONTROLS', () => {
    it('should NOT allow User B to update User A placeholder', async () => {
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'ph_hero_title',
          testUserB.id,
          'Unauthorized edit',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if placeholder ID does not exist', async () => {
      await expect(
        placeholdersService.updatePlaceholderValue(
          sampleDesign.id,
          'non_existent_ph',
          testUserA.id,
          'Some Value',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should clear placeholder value cleanly without mutating others', async () => {
      await placeholdersService.updatePlaceholderValue(
        sampleDesign.id,
        'ph_hero_title',
        testUserA.id,
        'Title to clear',
      );

      const clearRes = await placeholdersService.clearPlaceholderValue(
        sampleDesign.id,
        'ph_hero_title',
        testUserA.id,
      );

      expect(clearRes.placeholder.value).toBeNull();
      expect(clearRes.totalFilled).toBe(0);
    });
  });
});
