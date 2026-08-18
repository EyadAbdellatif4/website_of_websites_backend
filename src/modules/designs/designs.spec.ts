import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { DesignsService, SafeDesignDto } from './designs.service';
import { Design, DesignStatus } from './entities/design.entity';
import { User } from '../users/entities/user.entity';
import { FileStorageService } from '../file-storage/file-storage.service';

describe('DesignsModule (Management, Storage & Ownership Tests)', () => {
  let sequelize: Sequelize;
  let designsService: DesignsService;
  let storageService: FileStorageService;
  let testUserA: User;
  let testUserB: User;
  const tempTestDir = path.resolve('./storage_test_designs');

  const validZipBuffer = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  const createTestDesign = async (user: User, name: string): Promise<Design> => {
    const designId = crypto.randomUUID();
    const storageKey = `designs/${user.id}/${designId}/original.zip`;
    await storageService.saveFile(storageKey, validZipBuffer);

    return Design.create({
      id: designId,
      user_id: user.id,
      name,
      file_name: 'test.zip',
      storage_key: storageKey,
      file_size: validZipBuffer.length,
      status: DesignStatus.UPLOADED,
      layout_data: null,
      placeholders_data: null,
    });
  };

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
        }),
      ],
      providers: [
        DesignsService,
        FileStorageService,
        {
          provide: 'DesignRepository',
          useValue: Design,
        },
      ],
    }).compile();

    designsService = moduleRef.get<DesignsService>(DesignsService);
    storageService = moduleRef.get<FileStorageService>(FileStorageService);
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

  describe('OWNERSHIP & SECURITY ISOLATION', () => {
    let designA: Design;

    beforeEach(async () => {
      designA = await createTestDesign(testUserA, 'User A Design');
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

    it('should retrieve design file buffer correctly', async () => {
      const { design, buffer } = await designsService.getDesignFileBuffer(
        designA.id,
        testUserA.id,
      );
      expect(design.id).toBe(designA.id);
      expect(buffer).toEqual(validZipBuffer);
    });
  });

  describe('FAILURE HANDLING & SAFETY', () => {
    it('should handle deletion cleanly if physical storage file is already missing', async () => {
      const design = await createTestDesign(testUserA, 'Missing Storage File Test');

      // Delete physical file directly first
      const storageKey = `designs/${testUserA.id}/${design.id}/original.zip`;
      await storageService.deleteFile(storageKey);

      // Deleting design should handle missing file gracefully without crashing
      const res = await designsService.deleteForUser(design.id, testUserA.id);
      expect(res.message).toBe('Design deleted successfully');
    });
  });
});
