import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalFileStorageService } from './local-file-storage.service';
import { InvalidFileInputException } from '../../common/exceptions/storage.exception';

describe('LocalFileStorageService', () => {
  let service: LocalFileStorageService;
  const testStorageDir = path.resolve('./test-uploads');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalFileStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'LOCAL_STORAGE_DIR') return testStorageDir;
              return fallback;
            },
          },
        },
      ],
    }).compile();

    service = module.get<LocalFileStorageService>(LocalFileStorageService);
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

  it('should prevent path traversal attacks', async () => {
    const traversalKey = '../../etc/passwd';
    const buffer = Buffer.from('malicious data');

    await expect(service.saveFile(traversalKey, buffer)).rejects.toThrow(
      InvalidFileInputException,
    );

    await expect(service.getFile(traversalKey)).rejects.toThrow(
      InvalidFileInputException,
    );
  });

  it('should reject keys containing null bytes', async () => {
    const nullByteKey = 'image.png\0.exe';
    const buffer = Buffer.from('data');

    await expect(service.saveFile(nullByteKey, buffer)).rejects.toThrow(
      InvalidFileInputException,
    );
  });
});
