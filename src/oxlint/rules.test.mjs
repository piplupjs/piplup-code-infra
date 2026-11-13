import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { rules } from './rules.mjs';

const require = createRequire(import.meta.url);
const oxlintBin = path.join(path.dirname(require.resolve('oxlint/package.json')), 'bin', 'oxlint');

describe('rules', () => {
  it('renames ESLint rules to their names in the presets', () => {
    expect(
      rules({
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        'import/order': ['error', { alphabetize: { order: 'asc' } }],
        'jsx-a11y/aria-role': 'off',
        'no-console': 'off',
        'piplup/no-guarded-throw': 'off',
        'react/prop-types': 'off',
      }),
    ).toEqual({
      'import-js/order': ['error', { alphabetize: { order: 'asc' } }],
      // oxlint's version differs, so the presets run the ESLint plugin's.
      'jsx-a11y-js/aria-role': 'off',
      'no-console': 'off',
      // oxlint's core rule covers the typescript-eslint one.
      'no-unused-vars': 'warn',
      'piplup/no-guarded-throw': 'off',
      'react-js/prop-types': 'off',
      'typescript/no-explicit-any': 'off',
    });
  });

  it('drops options oxlint rejects that only repeat the defaults', () => {
    expect(rules({ 'vitest/no-focused-tests': ['error', { fixable: true }] })).toEqual({
      'vitest/no-focused-tests': 'error',
    });
  });

  it('throws for a rule oxlint has no way to run', () => {
    expect(() => rules({ 'unknown-plugin/rule': 'off' })).toThrow(/no oxlint equivalent/);
  });

  it('turns off preset rules in oxlint by their ESLint names', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-rules-'));
    try {
      await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "rules", "type": "module" }');
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(
        path.join(dir, 'src/a.ts'),
        [
          'export function f(a: number) {',
          '  const unused = 1;',
          '  if (a) {',
          '    return 1;',
          '  } else {',
          '    return 2;',
          '  }',
          '}',
          '',
        ].join('\n'),
      );
      const indexUrl = pathToFileURL(path.join(import.meta.dirname, 'index.mjs')).href;
      /** @param {string} rulesSource */
      const lint = async (rulesSource) => {
        await fs.writeFile(
          path.join(dir, 'oxlint.config.ts'),
          `import { presets, rules } from '${indexUrl}';\n\nexport default { extends: [presets.recommended], rules: ${rulesSource} };\n`,
        );
        const { stdout } = spawnSync(process.execPath, [oxlintBin, '-f', 'unix', 'src'], {
          cwd: dir,
          encoding: 'utf8',
        });
        return [...stdout.matchAll(/\[\w+\/(.+)\]$/gm)].map(([, rule]) => rule).sort();
      };

      expect(await lint('{}')).toEqual(['eslint(no-unused-vars)', 'eslint-js(no-else-return)']);
      expect(
        await lint(
          "rules({ '@typescript-eslint/no-unused-vars': 'off', 'no-else-return': 'off' })",
        ),
      ).toEqual([]);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 120_000);
});
