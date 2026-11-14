import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configs as docsConfigs } from '../docs.mjs';
import plugin from '../index.mjs';

import { configs } from './index.mjs';

/** A file of each kind, with a line that most configs have something to say about. */
const SAMPLES = {
  'data.json': '{ "a": 1 }\n',
  'package.json': '{ "name": "sample", "version": "1.0.0" }\n',
  'README.md': '# Title\n\nText.\n',
  'src/a.mjs': "import { b } from './b.mjs';\n\nexport const a = { z: 1, a: b };\n",
  'src/a.test.tsx': "import { it } from 'vitest';\n\nit('works', () => {});\n",
  'src/a.ts': 'export const a: { z: number; a: number } = { z: 1, a: 2 };\n',
  'src/component.tsx':
    'import * as React from \'react\';\n\nexport function A() {\n  return <img src="a.png" />;\n}\n',
};

describe('configs', () => {
  /** @type {string} */
  let dir;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'piplup-configs-'));
    await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "fixture" }');
    // For the type-aware part of `docs`, which needs a TypeScript project around the files.
    await fs.writeFile(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { allowJs: true, jsx: 'preserve', module: 'nodenext', noEmit: true },
        include: ['**/*'],
      }),
    );
    // On disk too, since the project service only knows files it can read.
    await fs.mkdir(path.join(dir, 'src'));
    await Promise.all(
      Object.entries(SAMPLES).map(([file, code]) => fs.writeFile(path.join(dir, file), code)),
    );
  });

  afterAll(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  it.each(Object.keys({ ...configs, ...docsConfigs }))(
    'lints with only `%s`, which registers the plugins it needs',
    { timeout: 60_000 },
    async (key) => {
      const config = /** @type {Record<string, import('eslint').Linter.Config[]>} */ ({
        ...configs,
        ...docsConfigs,
      })[key];
      const eslint = new ESLint({ cwd: dir, overrideConfig: config, overrideConfigFile: true });
      for (const [file, code] of Object.entries(SAMPLES)) {
        // eslint-disable-next-line no-await-in-loop -- one file at a time keeps failures readable
        const [result] = await eslint.lintText(code, { filePath: path.join(dir, file) });
        const fatal = result.messages.filter((message) => message.fatal && !message.ruleId);
        expect(fatal, `${key} on ${file}`).toEqual([]);
      }
    },
  );

  it('names every config object', () => {
    for (const [key, value] of Object.entries({ ...configs, ...docsConfigs })) {
      for (const config of value) {
        expect(config.name, `${key}: ${JSON.stringify(Object.keys(config))}`).toMatch(/^piplup\//);
      }
    }
  });

  it('leaves React Compiler out of `recommended`', () => {
    const names = new Set(configs.recommended.map(({ name }) => name));
    expect(names.has('piplup/react-compiler')).toBe(false);
    expect(names.has('piplup/typescript')).toBe(true);
  });

  it.each(['oxlint.config.ts', 'oxfmt.config.ts', 'src/a.mjs'])(
    'requires extensions in `%s`, which Node.js loads',
    async (file) => {
      const eslint = new ESLint({
        cwd: dir,
        overrideConfig: configs.recommended,
        overrideConfigFile: true,
      });
      const config = await eslint.calculateConfigForFile(path.join(dir, file));
      expect(config.rules['import/extensions']).toEqual([
        2,
        'ignorePackages',
        { js: 'always', mjs: 'always' },
      ]);
    },
  );

  it('leaves out extensions in other TypeScript files', async () => {
    const eslint = new ESLint({
      cwd: dir,
      overrideConfig: configs.recommended,
      overrideConfigFile: true,
    });
    const config = await eslint.calculateConfigForFile(path.join(dir, 'vite.config.ts'));
    expect(config.rules['import/extensions'][2]).toMatchObject({ mjs: 'never', ts: 'never' });
  });

  it('exposes the configs on the plugin, which can be registered next to them', async () => {
    expect(plugin.configs.recommended).toBe(configs.recommended);
    const eslint = new ESLint({
      cwd: dir,
      // ESLint resolves `extends: ['piplup/recommended']` from the plugins of the same object.
      overrideConfig: defineConfig({
        extends: ['piplup/recommended'],
        plugins: { piplup: plugin },
      }),
      overrideConfigFile: true,
    });
    const [result] = await eslint.lintText(SAMPLES['src/a.ts'], {
      filePath: path.join(dir, 'src/a.ts'),
    });
    expect(result.messages.map(({ ruleId }) => ruleId)).toContain('perfectionist/sort-objects');
  }, 60_000);
});
