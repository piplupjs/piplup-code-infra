import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { oxlintFindings } from '../utils/oxlint-parity.mjs';

import { combine } from './combine.mjs';

describe('combine', () => {
  it('merges configs, with later ones winning', () => {
    expect(
      combine(
        {
          globals: { a: 'readonly' },
          ignorePatterns: ['dist'],
          jsPlugins: [{ name: 'one', specifier: '/one.mjs' }],
          options: { typeAware: true },
          plugins: ['react'],
          rules: { 'no-console': 'error', 'no-var': 'error' },
          settings: { react: { version: '19.0.0' } },
        },
        {
          globals: { b: 'writable' },
          ignorePatterns: ['dist', 'build'],
          jsPlugins: [
            { name: 'one', specifier: '/one.mjs' },
            { name: 'two', specifier: '/two.mjs' },
          ],
          plugins: ['react', 'vitest'],
          rules: { 'no-console': 'off' },
          settings: { 'jsx-a11y': { components: { Img: 'img' } }, react: { pragma: 'h' } },
        },
      ),
    ).toEqual({
      globals: { a: 'readonly', b: 'writable' },
      ignorePatterns: ['dist', 'build'],
      jsPlugins: [
        { name: 'one', specifier: '/one.mjs' },
        { name: 'two', specifier: '/two.mjs' },
      ],
      options: { typeAware: true },
      plugins: ['react', 'vitest'],
      rules: { 'no-console': 'off', 'no-var': 'error' },
      settings: {
        'jsx-a11y': { components: { Img: 'img' } },
        react: { pragma: 'h', version: '19.0.0' },
      },
    });
  });

  it('lets a later top-level rule win over an earlier override', () => {
    /** @type {import('./create-config.mjs').Override} */
    const testOverride = { files: ['**/*.test.ts'], rules: { 'no-console': 'off' } };
    /** @type {import('./create-config.mjs').Override} */
    const ownOverride = { files: ['scripts/**'], rules: { 'no-console': 'warn' } };
    expect(
      combine(
        { overrides: [testOverride], rules: { 'no-console': 'error' } },
        { overrides: [ownOverride], rules: { 'no-console': 'error', 'no-var': 'error' } },
      ),
    ).toEqual({
      overrides: [
        testOverride,
        // Before the later config's own overrides, which still win over its top-level rules.
        { files: ['**/*'], rules: { 'no-console': 'error' } },
        ownOverride,
      ],
      rules: { 'no-console': 'error', 'no-var': 'error' },
    });
  });

  it('keeps the settings and rules oxlint `extends` would drop or lose', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-combine-'));
    try {
      await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "combine", "type": "module" }');
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(path.join(dir, 'src/a.jsx'), 'export const a = <Img src="a.png" />;\n');
      await fs.writeFile(
        path.join(dir, 'src/a.test.ts'),
        "import { it } from 'vitest';\n\nit('works', () => {});\n",
      );
      const indexUrl = pathToFileURL(path.join(import.meta.dirname, 'index.mjs')).href;
      const configPath = path.join(dir, 'oxlint.config.ts');
      await fs.writeFile(
        configPath,
        [
          `import { combine, presets, rules } from '${indexUrl}';`,
          '',
          'export default combine(presets.recommended, presets.test, {',
          "  rules: rules({ 'vitest/expect-expect': 'off' }),",
          "  settings: { 'jsx-a11y': { components: { Img: 'img' } } },",
          '});',
          '',
        ].join('\n'),
      );
      const findings = [...oxlintFindings(configPath, dir, ['src'])];
      // The setting makes `Img` an image, which needs `alt`.
      expect(findings).toContain('src/a.jsx:1 jsx-a11y/alt-text');
      // The test preset enables `expect-expect` for test files, and the project turned it off.
      expect(findings.filter((finding) => finding.startsWith('src/a.test.ts'))).toEqual([]);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 120_000);
});
