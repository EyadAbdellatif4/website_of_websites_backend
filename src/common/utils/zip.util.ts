import AdmZip from 'adm-zip';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export type FileType = 'svg' | 'image' | 'font' | 'other';

export interface ExtractedZipEntry {
  entryPath: string;
  type: FileType;
  size: number;
  buffer: Buffer;
}

const SVG_EXTS = new Set(['.svg']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf']);
const DISALLOWED_EXTS = new Set([
  '.js', '.ts', '.exe', '.bat', '.sh', '.cmd', '.vbs', '.ps1', '.dll', '.php', '.py',
]);

export class ZipProcessor {
  process(zipBuffer: Buffer): ExtractedZipEntry[] {
    return extractZipEntries(zipBuffer);
  }
}

export function extractZipEntries(zipBuffer: Buffer): ExtractedZipEntry[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new BadRequestException('Invalid or corrupted ZIP archive');
  }

  const entries: ExtractedZipEntry[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const rawName = entry.entryName;

    // Prevent path traversal & absolute paths
    if (rawName.includes('..') || rawName.startsWith('/') || rawName.startsWith('\\')) {
      continue;
    }

    const ext = extname(rawName).toLowerCase();
    if (DISALLOWED_EXTS.has(ext)) {
      continue;
    }

    let type: FileType = 'other';
    if (SVG_EXTS.has(ext)) type = 'svg';
    else if (IMAGE_EXTS.has(ext)) type = 'image';
    else if (FONT_EXTS.has(ext)) type = 'font';

    entries.push({
      entryPath: rawName,
      type,
      size: entry.header.size,
      buffer: entry.getData(),
    });
  }

  return entries;
}
