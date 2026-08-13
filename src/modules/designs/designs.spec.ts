import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { DesignsService, SafeDesignDto } from './designs.service';
import { Design, DesignStatus } from './entities/design.entity';
import { User } from '../users/entities/user.entity';
import { LocalFileStorageService } from '../file-storage/local-file-storage.service';
import { FILE_STORAGE_SERVICE } from '../file-storage/storage.constants';
import { preventPathTraversal } from '../../common/utils/path-traversal.util';
import { InvalidFileInputException } from '../../common/exceptions/storage.exception';
import envConfig from '../../config/env.config';

describe('DesignsModule (Upload, Storage & Ownership Tests)', () => {
  let sequelize: Sequelize;
  let designsService: DesignsService;
  let storageService: LocalFileStorageService;
  let testUserA: User;
  let testUserB: User;
  const tempTestDir = path.resolve('./storage_test_designs');

  // Valid ZIP buffer header signature: PK\x03\x04 + dummy bytes
  const validZipBuffer = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  // Fake non-ZIP buffer
  const fakeNonZipBuffer = Buffer.from('Hello world this is not a zip file');

  const mockMulterFile = (
    buffer: Buffer,
    filename = 'test-design.zip',
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'application/zip',
    buffer,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: new Readable(),
  });

  beforeAll(async () => {
    process.env.FILE_STORAGE_PATH = tempTestDir;

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

    designsService = moduleRef.get<DesignsService>(DesignsService);
    storageService =
      moduleRef.get<LocalFileStorageService>(FILE_STORAGE_SERVICE);
  });

  afterAll(async () => {
    await sequelize.close();
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  beforeEach(async () => {
    await Design.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    testUserA = await User.create({
      email: 'usera@example.com',
      password_hash: 'hashA',
    });

    testUserB = await User.create({
      email: 'userb@example.com',
      password_hash: 'hashB',
    });
  });

  describe('ZIP FILE UPLOAD & VALIDATION', () => {
    it('should successfully upload a valid ZIP and store physical file and database record', async () => {
      const file = mockMulterFile(validZipBuffer, 'hotel-design.zip');
      const result = await designsService.uploadDesign(
        testUserA,
        file,
        'Hotel Landing Page',
      );

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Hotel Landing Page');
      expect(result.fileName).toBe('hotel-design.zip');
      expect(result.fileSize).toBe(validZipBuffer.length);
      expect(result.status).toBe(DesignStatus.UPLOADED);
      expect(result.layoutData).toBeNull();
      expect(result.placeholdersData).toBeNull();

      // Verify physical storage existence via storage service
      const storageKey = `designs/${testUserA.id}/${result.id}/original.zip`;
      const exists = await storageService.exists(storageKey);
      expect(exists).toBe(true);

      const storedBuffer = await storageService.getFile(storageKey);
      expect(storedBuffer).toEqual(validZipBuffer);
    });

    it('should reject upload if file is missing or empty', async () => {
      const emptyFile = mockMulterFile(Buffer.from([]), 'empty.zip');
      await expect(
        designsService.uploadDesign(testUserA, emptyFile, 'Test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject upload if design name is empty or missing', async () => {
      const file = mockMulterFile(validZipBuffer);
      await expect(
        designsService.uploadDesign(testUserA, file, '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-ZIP files or fake magic-byte headers', async () => {
      const fakeFile = mockMulterFile(fakeNonZipBuffer, 'fake.zip');
      await expect(
        designsService.uploadDesign(testUserA, fakeFile, 'Fake Design'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files ending with executable extensions', async () => {
      const exeFile = mockMulterFile(validZipBuffer, 'malicious.exe');
      await expect(
        designsService.uploadDesign(testUserA, exeFile, 'Malicious File'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding max file size limit', async () => {
      const file = mockMulterFile(validZipBuffer);
      Object.defineProperty(file, 'size', { value: 60 * 1024 * 1024 }); // 60 MB

      await expect(
        designsService.uploadDesign(testUserA, file, 'Oversized Design'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OWNERSHIP & SECURITY ISOLATION', () => {
    let designA: SafeDesignDto;

    beforeEach(async () => {
      const file = mockMulterFile(validZipBuffer, 'designA.zip');
      designA = await designsService.uploadDesign(
        testUserA,
        file,
        'User A Design',
      );
    });

    it('should allow user A to list their own designs', async () => {
      const userADesigns = await designsService.findAllForUser(testUserA.id);
      expect(userADesigns.length).toBe(1);
      expect(userADesigns[0].id).toBe(designA.id);
    });

    it('should NOT allow user B to see user A designs in list', async () => {
      const userBDesigns = await designsService.findAllForUser(testUserB.id);
      expect(userBDesigns.length).toBe(0);
    });

    it('should allow user A to retrieve their design by ID', async () => {
      const retrieved = await designsService.findOneForUser(
        designA.id,
        testUserA.id,
      );
      expect(retrieved.id).toBe(designA.id);
    });

    it('should throw 404 NotFoundException when user B tries to access user A design', async () => {
      await expect(
        designsService.findOneForUser(designA.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should NOT allow user B to delete user A design', async () => {
      await expect(
        designsService.deleteForUser(designA.id, testUserB.id),
      ).rejects.toThrow(NotFoundException);

      // Verify user A design still exists
      const stillExists = await designsService.findOneForUser(
        designA.id,
        testUserA.id,
      );
      expect(stillExists).toBeDefined();
    });

    it('should allow user A to delete their design, removing physical file and DB record', async () => {
      const deleteResult = await designsService.deleteForUser(
        designA.id,
        testUserA.id,
      );
      expect(deleteResult.message).toBe('Design deleted successfully');

      // Verify DB record is gone
      await expect(
        designsService.findOneForUser(designA.id, testUserA.id),
      ).rejects.toThrow(NotFoundException);

      // Verify physical storage file is gone
      const storageKey = `designs/${testUserA.id}/${designA.id}/original.zip`;
      const fileExists = await storageService.exists(storageKey);
      expect(fileExists).toBe(false);
    });
  });

  describe('FAILURE ROLLBACK & SAFETY', () => {
    it('should clean up physical storage file if database record creation fails', async () => {
      const file = mockMulterFile(validZipBuffer, 'rollback-test.zip');
      const keySpy = jest.spyOn(Design, 'create').mockImplementationOnce(() => {
        throw new Error('Simulated Database Error during insertion');
      });

      await expect(
        designsService.uploadDesign(testUserA, file, 'Rollback Test'),
      ).rejects.toThrow();

      keySpy.mockRestore();
    });

    it('should handle deletion cleanly if physical storage file is already missing', async () => {
      const file = mockMulterFile(validZipBuffer, 'missing-file.zip');
      const design = await designsService.uploadDesign(
        testUserA,
        file,
        'Missing Storage File Test',
      );

      // Delete physical file directly first
      const storageKey = `designs/${testUserA.id}/${design.id}/original.zip`;
      await storageService.deleteFile(storageKey);

      // Attempting design deletion should handle missing file gracefully without crashing
      const res = await designsService.deleteForUser(design.id, testUserA.id);
      expect(res.message).toBe('Design deleted successfully');
    });
  });

  describe('PATH TRAVERSAL SECURITY TEST', () => {
    it('should prevent malicious path traversal keys escaping root directory', () => {
      const root = path.resolve('./storage');

      expect(() => preventPathTraversal(root, '../../etc/passwd')).toThrow(
        InvalidFileInputException,
      );
      expect(() =>
        preventPathTraversal(root, '..\\..\\Windows\\System32'),
      ).toThrow(InvalidFileInputException);
      expect(() =>
        preventPathTraversal(root, 'designs/user/../../../evil'),
      ).toThrow(InvalidFileInputException);
    });
  });
});
