import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  let service: FileStorageService;
  const testStorageDir = path.resolve('./test-uploads');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'LOCAL_STORAGE_DIR' || key === 'FILE_STORAGE_PATH') return testStorageDir;
              return fallback;
            },
          },
        },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
  });

  afterEach(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('should save and retrieve a file successfully', async () => {
    const key = 'test-folder/sample.txt';
    const content = Buffer.from('Hello, FileStorage!');

    const savedKey = await service.saveFile(key, content);
    expect(savedKey).toBe(key);

    const exists = await service.exists(key);
    expect(exists).toBe(true);

    const readBuffer = await service.getFile(key);
    expect(readBuffer.toString()).toBe('Hello, FileStorage!');
  });

  it('should delete an existing file', async () => {
    const key = 'to-delete.txt';
    await service.saveFile(key, Buffer.from('delete me'));

    expect(await service.exists(key)).toBe(true);

    await service.deleteFile(key);
    expect(await service.exists(key)).toBe(false);
  });

  it('should return false for non-existent file in exists()', async () => {
    const exists = await service.exists('non-existent.txt');
    expect(exists).toBe(false);
  });
});
