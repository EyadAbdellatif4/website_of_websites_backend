import * as path from 'path';
import { InvalidFileInputException } from '../exceptions/storage.exception';

/**
 * Validates and resolves a relative key against a root directory,
 * preventing path traversal, null byte injections, and directory escape attempts.
 */
export function preventPathTraversal(rootDir: string, key: string): string {
  if (!key || typeof key !== 'string') {
    throw new InvalidFileInputException(
      'Storage key must be a non-empty string',
    );
  }

  // Prevent null byte injection
  if (key.indexOf('\0') !== -1) {
    throw new InvalidFileInputException(
      'Storage key contains invalid characters (null byte)',
    );
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(resolvedRoot, key);

  // Ensure resolved path starts with the root directory path
  if (
    !resolvedTarget.startsWith(resolvedRoot + path.sep) &&
    resolvedTarget !== resolvedRoot
  ) {
    throw new InvalidFileInputException('Path traversal attempt detected');
  }

  return resolvedTarget;
}
