import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileStorage } from './file-storage.interface';
import { preventPathTraversal } from '../../common/utils/path-traversal.util';
import { StorageException } from '../../common/exceptions/storage.exception';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly storageDir: string;

  constructor(private readonly configService: ConfigService) {
    const rawDir =
      this.configService.get<string>('LOCAL_STORAGE_DIR') ?? './uploads';
    this.storageDir = path.resolve(rawDir);
  }

  async saveFile(key: string, data: Buffer): Promise<string> {
    try {
      const targetPath = preventPathTraversal(this.storageDir, key);
      const targetDir = path.dirname(targetPath);

      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, data);

      return key;
    } catch (err) {
      if (err instanceof StorageException) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown storage write error';
      throw new StorageException(`Failed to save file '${key}': ${message}`);
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      const targetPath = preventPathTraversal(this.storageDir, key);
      return await fs.readFile(targetPath);
    } catch (err) {
      if (err instanceof StorageException) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown storage read error';
      throw new StorageException(`Failed to read file '${key}': ${message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const targetPath = preventPathTraversal(this.storageDir, key);
      await fs.unlink(targetPath);
    } catch (err: unknown) {
      if (err instanceof StorageException) {
        throw err;
      }
      const nodeError = err as { code?: string; message?: string };
      // Ignore if file does not exist during deletion
      if (nodeError.code !== 'ENOENT') {
        throw new StorageException(
          `Failed to delete file '${key}': ${nodeError.message ?? 'Unknown error'}`,
        );
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const targetPath = preventPathTraversal(this.storageDir, key);
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
