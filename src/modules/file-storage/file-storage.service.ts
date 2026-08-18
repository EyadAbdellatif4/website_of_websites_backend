import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  private readonly storageDir: string;

  constructor(private readonly configService: ConfigService) {
    const rawDir =
      this.configService.get<string>('FILE_STORAGE_PATH') ??
      this.configService.get<string>('LOCAL_STORAGE_DIR') ??
      './storage';
    this.storageDir = path.resolve(rawDir);
  }

  private getPath(key: string): string {
    return path.join(this.storageDir, key);
  }

  async saveFile(key: string, data: Buffer): Promise<string> {
    const targetPath = this.getPath(key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, data);
    return key;
  }

  async getFile(key: string): Promise<Buffer> {
    return fs.readFile(this.getPath(key));
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await fs.unlink(this.getPath(key));
    } catch (err: unknown) {
      const nodeError = err as { code?: string };
      if (nodeError.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getPath(key));
      return true;
    } catch {
      return false;
    }
  }
}
