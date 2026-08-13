import { imageSize } from 'image-size';

export interface ImageInspectionMetadata {
  width: number | null;
  height: number | null;
  format: string | null;
  size: number;
  corrupted: boolean;
  error?: string;
}

export class ImageInspector {
  inspect(buffer: Buffer, filename: string): ImageInspectionMetadata {
    const size = buffer.length;
    try {
      // Support both function and module default imports if any
      const getImageDimensions =
        typeof imageSize === 'function'
          ? imageSize
          : (imageSize as unknown as { imageSize: typeof imageSize }).imageSize;

      const dimensions = getImageDimensions(buffer);
      return {
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        format: dimensions?.type ?? this.guessFormatFromFilename(filename),
        size,
        corrupted: false,
      };
    } catch (err) {
      return {
        width: null,
        height: null,
        format: this.guessFormatFromFilename(filename),
        size,
        corrupted: true,
        error:
          err instanceof Error
            ? err.message
            : 'Corrupted or unsupported image format',
      };
    }
  }

  private guessFormatFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jpeg' || ext === 'jpg') return 'jpg';
    if (ext === 'png') return 'png';
    if (ext === 'webp') return 'webp';
    if (ext === 'gif') return 'gif';
    return ext ?? 'unknown';
  }
}
