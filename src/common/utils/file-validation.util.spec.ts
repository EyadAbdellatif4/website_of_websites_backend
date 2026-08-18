import { BadRequestException } from '@nestjs/common';
import { validateImportFile } from './file-validation.util';

describe('file-validation.util', () => {
  const createMockFile = (
    originalname: string,
    buffer: Buffer,
    mimetype = 'application/octet-stream',
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  });

  describe('validateImportFile', () => {
    it('should successfully validate a valid ZIP file', () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const file = createMockFile('archive.zip', zipBuffer, 'application/zip');

      const result = validateImportFile(file);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('zip');
      expect(result.sanitizedName).toBe('archive.zip');
      expect(result.size).toBe(zipBuffer.length);
    });

    it('should successfully validate a valid SVG file', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>');
      const file = createMockFile('logo.svg', svgBuffer, 'image/svg+xml');

      const result = validateImportFile(file);

      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('svg');
      expect(result.sanitizedName).toBe('logo.svg');
    });

    it('should reject when file is undefined or buffer is empty', () => {
      expect(() =>
        validateImportFile(null as unknown as Express.Multer.File),
      ).toThrow(BadRequestException);

      const emptyFile = createMockFile('empty.zip', Buffer.alloc(0));
      expect(() => validateImportFile(emptyFile)).toThrow(
        BadRequestException,
      );
    });

    it('should reject dangerous/disallowed file extensions', () => {
      const file = createMockFile('script.js', Buffer.from('console.log(1)'));
      expect(() => validateImportFile(file)).toThrow(BadRequestException);
      expect(() => validateImportFile(file)).toThrow(
        /Disallowed file type/,
      );
    });

    it('should reject unsupported file formats (like .txt or .png)', () => {
      const file = createMockFile('document.txt', Buffer.from('hello world'));
      expect(() => validateImportFile(file)).toThrow(
        /Only valid ZIP archives \(\.zip\) or SVG files \(\.svg\) are allowed/,
      );
    });

    it('should reject ZIP files with invalid magic header', () => {
      const corruptZip = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const file = createMockFile('corrupt.zip', corruptZip);

      expect(() => validateImportFile(file)).toThrow(
        /Not a valid ZIP archive signature/,
      );
    });

    it('should reject SVG files missing svg/xml tags', () => {
      const invalidSvg = Buffer.from('just some text content');
      const file = createMockFile('fake.svg', invalidSvg, 'image/svg+xml');

      expect(() => validateImportFile(file)).toThrow(
        /Not a valid SVG markup document/,
      );
    });

    it('should reject files exceeding maxSizeBytes option', () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const file = createMockFile('large.zip', zipBuffer);

      expect(() =>
        validateImportFile(file, { maxSizeBytes: 2 }),
      ).toThrow(/exceeds maximum allowed limit/);
    });

    it('should enforce allowedTypes restriction when specified', () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const file = createMockFile('archive.zip', zipBuffer);

      expect(() =>
        validateImportFile(file, { allowedTypes: ['svg'] }),
      ).toThrow(/File type 'zip' is not allowed for this operation/);
    });
  });
});
