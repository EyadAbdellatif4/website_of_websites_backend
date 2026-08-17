import { Injectable, Inject } from '@nestjs/common';
import * as path from 'path';
import { FILE_STORAGE_SERVICE } from '../../file-storage/storage.constants';
import { FileStorage } from '../../file-storage/file-storage.interface';
import { CopiedAsset, RenderedFile } from '../interfaces/generator.interface';

@Injectable()
export class AssetBundlerService {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorage: FileStorage,
  ) {}

  /**
   * Identifies user-uploaded placeholder images, retrieves their binary buffers,
   * normalizes filenames, and bundles them into public/assets/ for the generated project.
   */
  async bundlePlaceholderAssets(
    placeholders: Array<{
      id: string;
      type: string;
      role: string;
      value?: unknown;
    }>,
  ): Promise<{ assets: CopiedAsset[]; files: RenderedFile[] }> {
    const assets: CopiedAsset[] = [];
    const files: RenderedFile[] = [];
    const seenStorageKeys = new Set<string>();

    for (const ph of placeholders) {
      if (!ph.value || typeof ph.value !== 'object') continue;

      const val = ph.value as Record<string, unknown>;
      const storageKey =
        typeof val.storage_key === 'string' ? val.storage_key : null;
      if (!storageKey || seenStorageKeys.has(storageKey)) continue;

      seenStorageKeys.add(storageKey);

      try {
        const fileBuffer = await this.fileStorage.getFile(storageKey);
        const rawFileName =
          typeof val.file_name === 'string' ? val.file_name : 'asset.png';

        // Sanitize file name: remove path separators and illegal characters
        const safeBaseName = path
          .basename(rawFileName)
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileName = `${ph.id}_${safeBaseName}`;
        const destinationRelativePath = `public/assets/${uniqueFileName}`;
        const publicUrlPath = `/assets/${uniqueFileName}`;

        const assetRecord: CopiedAsset = {
          originalStorageKey: storageKey,
          destinationRelativePath,
          publicUrlPath,
          fileName: uniqueFileName,
          size: fileBuffer.length,
          mimeType:
            typeof val.mime_type === 'string' ? val.mime_type : 'image/png',
        };

        assets.push(assetRecord);

        files.push({
          relativePath: destinationRelativePath,
          content: fileBuffer,
          isBinary: true,
        });
      } catch (err) {
        // If file could not be read from storage, log warning and continue safely without crashing
        console.warn(
          `[AssetBundler] Could not bundle asset at key "${storageKey}":`,
          err,
        );
      }
    }

    return { assets, files };
  }
}
