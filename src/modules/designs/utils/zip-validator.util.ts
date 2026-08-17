import { BadRequestException } from '@nestjs/common';

const ZIP_HEADER_MAGIC = [
  [0x50, 0x4b, 0x03, 0x04], // Standard ZIP local file header
  [0x50, 0x4b, 0x05, 0x06], // Empty ZIP / End of central directory header
  [0x50, 0x4b, 0x07, 0x08], // Data descriptor ZIP header
];

const DISALLOWED_EXTENSIONS = [
  '.exe',
  '.js',
  '.ts',
  '.html',
  '.htm',
  '.bat',
  '.sh',
  '.cmd',
  '.vbs',
  '.ps1',
  '.dll',
  '.so',
];

export function validateZipFile(file: Express.Multer.File): void {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Design file is required and cannot be empty');
  }

  const originalNameLower = (file.originalname ?? '').toLowerCase();

  // Check disallowed extensions
  for (const ext of DISALLOWED_EXTENSIONS) {
    if (originalNameLower.endsWith(ext)) {
      throw new BadRequestException(
        `Disallowed file type: files ending with '${ext}' are not permitted`,
      );
    }
  }

  const isSvg =
    originalNameLower.endsWith('.svg') ||
    file.mimetype === 'image/svg+xml' ||
    file.buffer.slice(0, 100).toString('utf-8').includes('<svg');

  const isZip = originalNameLower.endsWith('.zip');

  if (!isZip && !isSvg) {
    throw new BadRequestException(
      'Only valid ZIP archives (.zip) or SVG files (.svg) are allowed',
    );
  }

  if (isZip) {
    // Check magic bytes for ZIP
    if (file.buffer.length < 4) {
      throw new BadRequestException(
        'File is too small to be a valid ZIP archive',
      );
    }

    const isZipMagic = ZIP_HEADER_MAGIC.some((magic) =>
      magic.every((byte, index) => file.buffer[index] === byte),
    );

    if (!isZipMagic) {
      throw new BadRequestException(
        'File content validation failed: Not a valid ZIP archive signature',
      );
    }
  } else if (isSvg) {
    // Validate SVG header
    const content = file.buffer.toString('utf-8');
    if (!content.includes('<svg') && !content.includes('<?xml')) {
      throw new BadRequestException(
        'File content validation failed: Not a valid SVG markup document',
      );
    }
  }
}
