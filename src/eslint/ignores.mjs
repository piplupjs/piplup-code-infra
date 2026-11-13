import fs from 'node:fs';
import * as path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';

/**
 * Ignores the files that the project's `.gitignore` and `.lintignore` list. A function, because it
 * reads them from disk.
 * @param {string} baseDirectory - The directory with the ignore files, usually `import.meta.dirname`.
 * @returns {import('eslint').Linter.Config[]}
 */
export function ignores(baseDirectory) {
  return ['.gitignore', '.lintignore']
    .map((file) => path.join(baseDirectory, file))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      ...includeIgnoreFile(filePath),
      name: `piplup/ignores (${path.basename(filePath)})`,
    }));
}
