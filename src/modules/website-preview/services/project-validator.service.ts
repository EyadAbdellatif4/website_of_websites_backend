import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectValidationResult } from '../interfaces/preview.interface';

@Injectable()
export class ProjectValidatorService {
  /**
   * Validates that the generated project directory is complete, well-formed,
   * and safe to run in a preview environment.
   */
  async validateProject(projectPath: string): Promise<ProjectValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checkedFiles: string[] = [];

    // 1. Verify project directory exists
    try {
      const dirStat = await fs.stat(projectPath);
      if (!dirStat.isDirectory()) {
        return {
          isValid: false,
          errors: ['Generated project path is not a directory.'],
          warnings: [],
          checkedFiles: [],
          projectPath,
        };
      }
    } catch {
      return {
        isValid: false,
        errors: ['Generated project directory does not exist.'],
        warnings: [],
        checkedFiles: [],
        projectPath,
      };
    }

    // 2. Validate package.json
    const pkgPath = path.join(projectPath, 'package.json');
    try {
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      checkedFiles.push('package.json');
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;

      if (!pkg.name) {
        warnings.push('package.json missing name field.');
      }
      if (!pkg.scripts || typeof pkg.scripts !== 'object') {
        errors.push('package.json missing scripts definition.');
      } else {
        const scripts = pkg.scripts as Record<string, unknown>;
        if (!scripts.dev) {
          errors.push('package.json missing "dev" script.');
        }
      }
    } catch (err) {
      errors.push(
        `package.json is missing or contains invalid JSON: ${err instanceof Error ? err.message : ''}`,
      );
    }

    // 3. Validate App Router files
    const requiredFiles = [
      'app/layout.tsx',
      'app/page.tsx',
      'app/globals.css',
      'tsconfig.json',
      'next.config.ts',
    ];

    for (const rel of requiredFiles) {
      const fullPath = path.join(projectPath, rel);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          checkedFiles.push(rel);
        } else {
          errors.push(`Required file "${rel}" is not a regular file.`);
        }
      } catch {
        errors.push(`Missing required file "${rel}".`);
      }
    }

    // 4. Validate Section Components
    const componentsDir = path.join(projectPath, 'components', 'sections');
    try {
      const sectionFiles = await fs.readdir(componentsDir);
      if (sectionFiles.length === 0) {
        errors.push('No section components found in components/sections/.');
      } else {
        for (const sf of sectionFiles) {
          checkedFiles.push(`components/sections/${sf}`);
        }
      }
    } catch {
      errors.push('Missing "components/sections" directory.');
    }

    // 5. Security & Traversal check: ensure all files stay inside project root
    try {
      const allFiles = await fs.readdir(projectPath, { recursive: true });
      for (const f of allFiles) {
        const full = path.resolve(projectPath, f);
        if (!full.startsWith(path.resolve(projectPath))) {
          errors.push(
            `Security violation: file "${f}" escapes project boundary.`,
          );
        }
      }
    } catch {
      // ignore
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedFiles,
      projectPath,
    };
  }
}
