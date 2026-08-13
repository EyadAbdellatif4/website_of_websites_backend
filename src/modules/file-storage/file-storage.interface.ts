export abstract class FileStorage {
  /**
   * Saves raw buffer data under the specified key/path safely.
   * Returns the canonical key/storage key.
   */
  abstract saveFile(key: string, data: Buffer): Promise<string>;

  /**
   * Retrieves the raw file buffer stored under key.
   */
  abstract getFile(key: string): Promise<Buffer>;

  /**
   * Deletes the file stored under key if it exists.
   */
  abstract deleteFile(key: string): Promise<void>;

  /**
   * Checks whether a file exists at key.
   */
  abstract exists(key: string): Promise<boolean>;
}
