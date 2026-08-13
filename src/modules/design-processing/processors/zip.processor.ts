import AdmZip from 'adm-zip';
import { BadRequestException } from '@nestjs/common';
import { preventPathTraversal } from '../../../common/utils/path-traversal.util';

export type FileType = 'svg' | 'image' | 'font' | 'disallowed' | 'other';

export interface ExtractedZipEntry {
  entryPath: string;
  type: FileType;
  size: number;
  buffer: Buffer;
}

export interface ZipProcessingLimits {
  maxZipEntries: number;
  maxZipUncompressedSize: number;
  maxSingleExtractedFileSize: number;
}

const DISALLOWED_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.sh',
  '.bat',
  '.exe',
  '.dll',
  '.php',
  '.py',
  '.cmd',
  '.vbs',
  '.ps1',
]);

const SVG_EXTENSIONS = new Set(['.svg']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf']);
const NESTED_ARCHIVE_EXTENSIONS = new Set([
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
]);

export class ZipProcessor {
  process(
    zipBuffer: Buffer,
    targetExtractedDir: string,
    limits: ZipProcessingLimits,
  ): ExtractedZipEntry[] {
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new BadRequestException(
        'Failed to parse ZIP archive: Invalid or corrupted ZIP file',
      );
    }

    const zipEntries = zip.getEntries();

    if (zipEntries.length > limits.maxZipEntries) {
      throw new BadRequestException(
        `ZIP archive contains too many entries (${zipEntries.length} > max ${limits.maxZipEntries})`,
      );
    }

    let cumulativeUncompressedSize = 0;
    const processedEntries: ExtractedZipEntry[] = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        continue;
      }

      const rawName = entry.entryName;

      // 1. Path traversal & security checks
      if (
        rawName.startsWith('/') ||
        rawName.startsWith('\\') ||
        /^[a-zA-Z]:[/\\]/.test(rawName)
      ) {
        throw new BadRequestException(
          `Absolute path detected in ZIP entry '${rawName}'`,
        );
      }

      // Check path traversal escaping extraction directory
      try {
        preventPathTraversal(targetExtractedDir, rawName);
      } catch (err) {
        throw new BadRequestException(
          `Path traversal attempt detected in ZIP entry '${rawName}': ${err instanceof Error ? err.message : 'Invalid entry path'}`,
        );
      }

      const uncompressedSize = entry.header.size;

      if (uncompressedSize > limits.maxSingleExtractedFileSize) {
        throw new BadRequestException(
          `ZIP entry '${rawName}' size (${uncompressedSize} bytes) exceeds max single file limit (${limits.maxSingleExtractedFileSize} bytes)`,
        );
      }

      cumulativeUncompressedSize += uncompressedSize;
      if (cumulativeUncompressedSize > limits.maxZipUncompressedSize) {
        throw new BadRequestException(
          `Total uncompressed ZIP size exceeds maximum limit of ${limits.maxZipUncompressedSize} bytes (ZIP bomb protection)`,
        );
      }

      // Determine file extension & classification
      const ext = this.getExtension(rawName);

      if (NESTED_ARCHIVE_EXTENSIONS.has(ext)) {
        // Skip nested archives for safety
        continue;
      }

      let type: FileType = 'other';
      if (DISALLOWED_EXTENSIONS.has(ext)) {
        type = 'disallowed';
      } else if (SVG_EXTENSIONS.has(ext)) {
        type = 'svg';
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        type = 'image';
      } else if (FONT_EXTENSIONS.has(ext)) {
        type = 'font';
      }

      // Do NOT extract disallowed executable scripts
      if (type === 'disallowed') {
        continue;
      }

      const buffer = entry.getData();
      processedEntries.push({
        entryPath: rawName,
        type,
        size: uncompressedSize,
        buffer,
      });
    }

    return processedEntries;
  }

  private getExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    return idx !== -1 ? filename.substring(idx).toLowerCase() : '';
  }
}
