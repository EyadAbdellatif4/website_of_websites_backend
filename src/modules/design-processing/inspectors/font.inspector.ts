export interface FontInspectionMetadata {
  filename: string;
  format: string;
  size: number;
}

export class FontInspector {
  inspect(buffer: Buffer, filename: string): FontInspectionMetadata {
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'unknown';
    return {
      filename,
      format: ext,
      size: buffer.length,
    };
  }
}
