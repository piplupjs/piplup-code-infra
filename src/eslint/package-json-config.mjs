import { defineConfig } from 'eslint/config';
import packageJson from 'eslint-plugin-package-json';

/**
 * Lints package.json files for publishing metadata. Published packages must
 * declare an SPDX license, an author and a repository pointing at their own
 * directory. Private packages must not carry publishing metadata.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createPackageJsonConfig() {
  return defineConfig([
    {
      extends: [packageJson.configs.recommended],
      files: ['**/package.json'],
      ignores: ['**/__fixtures__/**'],
      name: 'package.json files',
      rules: {
        // npm only auto-includes "main" when it has no "./" prefix; removing it from "files" can drop the entry point.
        'package-json/no-redundant-files': 'off',
        'package-json/require-author': ['error', { ignorePrivate: true }],
        'package-json/require-description': ['error', { ignorePrivate: true }],
        // CLI-only packages have no "exports".
        'package-json/require-exports': 'off',
        // Packages built into a separate directory get these fields in the generated package.json.
        'package-json/require-files': 'off',
        'package-json/require-sideEffects': 'off',
        'package-json/require-type': 'off',
        'package-json/restrict-private-properties': [
          'error',
          // `publishConfig.directory` is allowed, also for private packages.
          { blockedProperties: ['files', 'license'] },
        ],
        // Condition order in "exports" is significant, and scripts are grouped by purpose.
        'package-json/sort-collections': 'off',
        // Peer dependencies are installed once at the workspace root.
        'package-json/specify-peers-locally': 'off',
        // Rejects the object form of "browser", which the browser field spec allows.
        'package-json/valid-browser': 'off',
      },
    },
  ]);
}
