import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export type SupportedFileType = 'zip' | 'svg';

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: SupportedFileType[];
}

export interface ValidatedFileResult {
  isValid: boolean;
  fileType: SupportedFileType;
  sanitizedName: string;
  size: number;
  buffer: Buffer;
}

const DISALLOWED_EXTS = new Set([
  '.exe', '.js', '.ts', '.html', '.htm', '.bat', '.sh',
  '.cmd', '.vbs', '.ps1', '.dll', '.so', '.php', '.py',
]);

const DEFAULT_MAX_FILE_SIZE = 52428800; // 50MB

/**
 * Validates an uploaded design file (ZIP archive or SVG vector file).
 */
export function validateImportFile(
  file: Express.Multer.File,
  options?: FileValidationOptions,
): ValidatedFileResult {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Design file is required and cannot be empty');
  }

  const originalName = file.originalname || 'unknown_file';
  const ext = extname(originalName).toLowerCase();

  // 1. Security blocklist check
  if (DISALLOWED_EXTS.has(ext)) {
    throw new BadRequestException(
      `Disallowed file type: files ending with '${ext}' are not permitted`,
    );
  }

  // 2. Format & type determination
  const isSvg = ext === '.svg' || file.mimetype === 'image/svg+xml' || file.buffer.includes('<svg');
  const isZip = ext === '.zip';

  if (!isZip && !isSvg) {
    throw new BadRequestException('Only valid ZIP archives (.zip) or SVG files (.svg) are allowed');
  }

  const fileType: SupportedFileType = isZip ? 'zip' : 'svg';
  if (options?.allowedTypes && !options.allowedTypes.includes(fileType)) {
    throw new BadRequestException(`File type '${fileType}' is not allowed for this operation`);
  }

  // 3. File size limit verification
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  if (file.size > maxSize) {
    throw new BadRequestException(`File size (${file.size} bytes) exceeds maximum allowed limit of ${maxSize} bytes`);
  }

  // 4. Content signature verification (Magic Bytes / Markup)
  if (fileType === 'zip') {
    const b = file.buffer;
    const isZipSignature = b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);
    if (!isZipSignature) {
      throw new BadRequestException('File content validation failed: Not a valid ZIP archive signature');
    }
  } else {
    const headerSnippet = file.buffer.subarray(0, 2048).toString('utf-8');
    if (!headerSnippet.includes('<svg') && !headerSnippet.includes('<?xml')) {
      throw new BadRequestException('File content validation failed: Not a valid SVG markup document');
    }
  }

  return {
    isValid: true,
    fileType,
    sanitizedName: originalName.replace(/[^\w.-]/g, '_'),
    size: file.size,
    buffer: file.buffer,
  };
}
