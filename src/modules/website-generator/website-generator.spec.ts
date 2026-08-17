import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WebsiteGeneratorService } from './website-generator.service';
import { TemplateRendererService } from './services/template-renderer.service';
import { AssetBundlerService } from './services/asset-bundler.service';
import { DesignsService } from '../designs/designs.service';
import { Design, DesignStatus } from '../designs/entities/design.entity';
import { User } from '../users/entities/user.entity';
import { LocalFileStorageService } from '../file-storage/local-file-storage.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import envConfig from '../../config/env.config';

describe('WebsiteGeneratorService (Full Generation Engine Tests)', () => {
  let sequelize: Sequelize;
  let generatorService: WebsiteGeneratorService;
  let designsService: DesignsService;
  let fileStorage: LocalFileStorageService;
  let testUserA: User;
  let testUserB: User;
  let sampleDesign: Design;
  const tempStorageDir = path.resolve('./storage_test_generator');

  const createSampleZip = (): Buffer => {
    const zip = new AdmZip();
    zip.addFile(
      'index.svg',
      Buffer.from('<svg><text>Hi</text></svg>', 'utf-8'),
    );
    return zip.toBuffer();
  };

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

    generatorService = moduleRef.get<WebsiteGeneratorService>(
      WebsiteGeneratorService,
    );
    designsService = moduleRef.get<DesignsService>(DesignsService);
    fileStorage = moduleRef.get<LocalFileStorageService>(FILE_STORAGE_SERVICE);
  });

  afterAll(async () => {
    await sequelize.close();
    try {
      await fs.rm(tempStorageDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  beforeEach(async () => {
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    testUserA = await User.create({
      email: 'creator_generator@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'attacker_generator@example.com',
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
      'Grand Hotel Luxury Website',
    );

    sampleDesign = await designsService.getDesignEntity(
      safeDto.id,
      testUserA.id,
    );

    // Save sample image asset to storage
    const assetStorageKey = `designs/${testUserA.id}/${sampleDesign.id}/content/ph_hero_img/12345_hero.png`;
    await fileStorage.saveFile(assetStorageKey, samplePngBuffer);

    // Set analyzed layout & placeholders
    sampleDesign.layout_data = {
      width: 1440,
      height: 2400,
      sections: [
        {
          id: 'sec_header',
          type: 'header',
          order: 1,
          bounds: { x: 0, y: 0, width: 1440, height: 80 },
        },
        {
          id: 'sec_hero',
          type: 'hero',
          order: 2,
          bounds: { x: 0, y: 80, width: 1440, height: 600 },
        },
        {
          id: 'sec_features',
          type: 'features',
          order: 3,
          bounds: { x: 0, y: 680, width: 1440, height: 500 },
        },
        {
          id: 'sec_custom_faq',
          type: 'custom_faq_section',
          order: 4,
          bounds: { x: 0, y: 1180, width: 1440, height: 400 },
        },
        {
          id: 'sec_footer',
          type: 'footer',
          order: 5,
          bounds: { x: 0, y: 1580, width: 1440, height: 120 },
        },
      ],
    };

    sampleDesign.placeholders_data = [
      {
        id: 'ph_brand_title',
        type: 'text',
        role: 'brand_title',
        section_id: 'sec_header',
        bounds: { x: 40, y: 20, width: 150, height: 40 },
        value: 'Grand Azure Resort',
      },
      {
        id: 'ph_hero_title',
        type: 'text',
        role: 'hero_heading',
        section_id: 'sec_hero',
        bounds: { x: 100, y: 150, width: 600, height: 100 },
        value: 'Luxury Coastal Escape',
      },
      {
        id: 'ph_hero_img',
        type: 'image',
        role: 'hero_image',
        section_id: 'sec_hero',
        bounds: { x: 800, y: 100, width: 500, height: 400 },
        value: {
          storage_key: assetStorageKey,
          file_name: 'hero.png',
          width: 1920,
          height: 1080,
          size: samplePngBuffer.length,
          mime_type: 'image/png',
        },
      },
      {
        id: 'ph_cta_btn',
        type: 'button',
        role: 'cta_button',
        section_id: 'sec_hero',
        bounds: { x: 100, y: 300, width: 180, height: 50 },
        value: {
          text: 'Reserve A Suite',
          url: '/suites',
        },
      },
      {
        id: 'ph_faq_q1',
        type: 'text',
        role: 'faq_item',
        section_id: 'sec_custom_faq',
        bounds: { x: 100, y: 1200, width: 400, height: 80 },
        value: null, // Test null fallback
        content_hint: 'What is check-in time?',
      },
    ];
    sampleDesign.status = DesignStatus.READY;
    await sampleDesign.save();
  });

  describe('1. NEXT.JS CODEBASE & FILE TREE GENERATION', () => {
    it('should generate complete Next.js App Router codebase from analyzed design', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      expect(result.success).toBe(true);
      expect(result.project.status).toBe('GENERATED');
      expect(result.project.totalFiles).toBeGreaterThan(10);
      expect(result.project.manifest.sectionsCount).toBe(5);

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      // Verify essential configuration files
      const pkgRaw = await fs.readFile(
        path.join(projectPath, 'package.json'),
        'utf-8',
      );
      const pkg = JSON.parse(pkgRaw) as {
        name: string;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      expect(pkg.name).toBe('grand-hotel-luxury-website');
      expect(pkg.dependencies.next).toBeDefined();
      expect(pkg.dependencies.react).toBeDefined();
      expect(pkg.devDependencies.tailwindcss).toBeDefined();

      const tsconfigRaw = await fs.readFile(
        path.join(projectPath, 'tsconfig.json'),
        'utf-8',
      );
      const tsconfig = JSON.parse(tsconfigRaw) as {
        compilerOptions: { jsx: string };
      };
      expect(tsconfig.compilerOptions.jsx).toBe('preserve');

      const nextConfig = await fs.readFile(
        path.join(projectPath, 'next.config.ts'),
        'utf-8',
      );
      expect(nextConfig).toContain('nextConfig');

      // Verify Next.js App Router files
      const layoutFile = await fs.readFile(
        path.join(projectPath, 'app/layout.tsx'),
        'utf-8',
      );
      expect(layoutFile).toContain('Grand Hotel Luxury Website');
      expect(layoutFile).toContain('export default function RootLayout');

      const pageFile = await fs.readFile(
        path.join(projectPath, 'app/page.tsx'),
        'utf-8',
      );
      expect(pageFile).toContain('HeaderSection');
      expect(pageFile).toContain('HeroSection');
      expect(pageFile).toContain('FeaturesSection');
      expect(pageFile).toContain('GenericSection');
      expect(pageFile).toContain('FooterSection');

      // Verify section components
      expect(
        await fs.stat(
          path.join(projectPath, 'components/sections/HeaderSection.tsx'),
        ),
      ).toBeDefined();
      expect(
        await fs.stat(
          path.join(projectPath, 'components/sections/HeroSection.tsx'),
        ),
      ).toBeDefined();
      expect(
        await fs.stat(
          path.join(projectPath, 'components/sections/FeaturesSection.tsx'),
        ),
      ).toBeDefined();
      expect(
        await fs.stat(
          path.join(projectPath, 'components/sections/GenericSection.tsx'),
        ),
      ).toBeDefined();
      expect(
        await fs.stat(
          path.join(projectPath, 'components/sections/FooterSection.tsx'),
        ),
      ).toBeDefined();

      // Verify README & .env.example
      const readme = await fs.readFile(
        path.join(projectPath, 'README.md'),
        'utf-8',
      );
      expect(readme).toContain('npm install');
      expect(readme).toContain('npm run dev');
    });

    it('should fall back to GenericSection for unknown/custom section types without crashing', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      const genericComp = await fs.readFile(
        path.join(projectPath, 'components/sections/GenericSection.tsx'),
        'utf-8',
      );
      expect(genericComp).toContain('export function GenericSection');
    });
  });

  describe('2. PLACEHOLDER CONTENT & VALUE MAPPING', () => {
    it('should map user-supplied text and button values into generated page', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      const pageContent = await fs.readFile(
        path.join(projectPath, 'app/page.tsx'),
        'utf-8',
      );
      expect(pageContent).toContain('Luxury Coastal Escape');
      expect(pageContent).toContain('Reserve A Suite');
      expect(pageContent).toContain('/suites');
    });

    it('should safely render null placeholder values using content hint fallbacks without throwing', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      const pageContent = await fs.readFile(
        path.join(projectPath, 'app/page.tsx'),
        'utf-8',
      );
      expect(pageContent).toContain('What is check-in time?');
    });
  });

  describe('3. ASSET BUNDLING & STORAGE ISOLATION', () => {
    it('should copy user uploaded placeholder images into public/assets/ and update image URLs', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      const publicAssetDir = path.join(projectPath, 'public', 'assets');
      const assetFiles = await fs.readdir(publicAssetDir);
      expect(assetFiles.length).toBe(1);
      expect(assetFiles[0]).toContain('ph_hero_img');

      // Verify copied file binary matches original
      const copiedBuffer = await fs.readFile(
        path.join(publicAssetDir, assetFiles[0]),
      );
      expect(copiedBuffer.equals(samplePngBuffer)).toBe(true);

      // Verify page references /assets/ and NOT /storage/users/...
      const pageContent = await fs.readFile(
        path.join(projectPath, 'app/page.tsx'),
        'utf-8',
      );
      expect(pageContent).toContain(`/assets/${assetFiles[0]}`);
      expect(pageContent).not.toContain('storage_test_generator');
      expect(pageContent).not.toContain('/storage/users/');
    });
  });

  describe('4. SECURITY & PERMISSIONS CONTROLS', () => {
    it('should NOT allow User B to generate website from User A design', async () => {
      await expect(
        generatorService.generateWebsite(sampleDesign.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject generation if design has no analyzed layout data', async () => {
      sampleDesign.layout_data = null;
      await sampleDesign.save();

      await expect(
        generatorService.generateWebsite(sampleDesign.id, testUserA.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify generated project contains NO backend environment secrets', async () => {
      const result = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const projectPath = path.join(
        tempStorageDir,
        'generated',
        testUserA.id,
        sampleDesign.id,
        result.project.generationId,
      );

      // Verify all generated files for absence of sensitive secrets
      const files = await fs.readdir(projectPath, { recursive: true });
      for (const rel of files) {
        const full = path.join(projectPath, rel);
        const stat = await fs.stat(full);
        if (stat.isFile()) {
          const content = await fs.readFile(full, 'utf-8');
          expect(content).not.toContain(
            process.env.GEMINI_API_KEY || 'fake-key',
          );
          expect(content).not.toContain(process.env.JWT_SECRET || 'jwt-secret');
        }
      }
    });
  });

  describe('5. ZIP ARCHIVE EXPORT & MANIFEST RETRIEVAL', () => {
    it('should retrieve latest generation manifest', async () => {
      const genRes = await generatorService.generateWebsite(
        sampleDesign.id,
        testUserA.id,
      );

      const manifest = await generatorService.getLatestGenerationManifest(
        sampleDesign.id,
        testUserA.id,
      );

      expect(manifest).toBeDefined();
      expect(manifest?.generationId).toBe(genRes.project.generationId);
      expect(manifest?.projectTarget).toBe(
        'Next.js App Router (TypeScript + Tailwind CSS)',
      );
    });

    it('should generate downloadable ZIP archive of the generated Next.js project', async () => {
      await generatorService.generateWebsite(sampleDesign.id, testUserA.id);

      const zipData = await generatorService.getGeneratedProjectZip(
        sampleDesign.id,
        testUserA.id,
      );

      expect(zipData.fileName).toContain('_nextjs_website.zip');
      expect(zipData.buffer.length).toBeGreaterThan(500);

      // Verify ZIP contents
      const zip = new AdmZip(zipData.buffer);
      const zipEntries = zip.getEntries();
      const entryNames = zipEntries.map((e) => e.entryName);

      expect(entryNames).toContain('package.json');
      expect(entryNames).toContain('app/page.tsx');
      expect(entryNames).toContain('app/layout.tsx');
    });
  });
});
