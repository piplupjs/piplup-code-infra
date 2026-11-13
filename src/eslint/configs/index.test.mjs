import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBaseConfig } from '../base-config.mjs';
import { configs as docsConfigs, createDocsConfig } from '../docs-config.mjs';
import { ignores } from '../ignores.mjs';
import plugin, { nodeSupport } from '../index.mjs';
import { createTestConfig } from '../test-config.mjs';

import { configs } from './index.mjs';

/** One file of each kind the configs treat differently. */
const FILES = [
  'src/a.js',
  'src/a.jsx',
  'src/a.mjs',
  'src/a.cjs',
  'src/a.ts',
  'src/a.tsx',
  'src/a.mts',
  'src/a.d.ts',
  'src/a.test.tsx',
  'src/a.spec.ts',
  'README.md',
  'docs/page.mdx',
  'data.json',
  'tsconfig.json',
  'settings.json5',
  'package.json',
  'packages/node-lib/src/index.ts',
  'packages/node-lib/package.json',
];

/** @param {unknown} value */
function plain(value) {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (typeof item === 'function') {
        return `[function ${item.name}]`;
      }
      // Parsers and plugins are objects with functions; compare them by name.
      if (key === 'parser' && item) {
        return item.meta?.name ?? item.name ?? '[parser]';
      }
      return item;
    }),
  );
}

/**
 * What ESLint would use for each file: everything but the plugin objects, which are compared by
 * name.
 * @param {string} cwd
 * @param {import('eslint').Linter.Config[]} config
 */
async function resolve(cwd, config) {
  const eslint = new ESLint({ cwd, overrideConfig: config, overrideConfigFile: true });
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const file of FILES) {
    // eslint-disable-next-line no-await-in-loop -- ESLint caches between calls
    const resolved = await eslint.calculateConfigForFile(path.join(cwd, file));
    result[file] = resolved
      ? plain({
          language: resolved.language,
          languageOptions: resolved.languageOptions,
          plugins: Object.keys(resolved.plugins ?? {}).sort(),
          processor: Boolean(resolved.processor),
          // A rule that's off and a rule that's absent behave the same.
          rules: Object.fromEntries(
            Object.entries(resolved.rules ?? {}).filter(([, entry]) => entry[0] !== 0),
          ),
          settings: resolved.settings,
        })
      : 'ignored';
  }
  return result;
}

describe('configs', () => {
  /** @type {string} */
  let dir;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'piplup-configs-'));
    await fs.mkdir(path.join(dir, 'packages/node-lib'), { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "fixture" }');
    await fs.writeFile(
      path.join(dir, 'packages/node-lib/package.json'),
      '{ "name": "node-lib", "engines": { "node": ">=20" } }',
    );
    await fs.writeFile(path.join(dir, '.gitignore'), 'build\n');
  });

  afterAll(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  it.each([
    {
      expected: () => [],
      name: 'recommended',
      options: {},
    },
    {
      expected: () => [configs.reactCompiler],
      name: 'recommended + reactCompiler',
      options: { enableReactCompiler: true },
    },
    {
      expected: () => [
        /** @type {import('eslint').Linter.Config} */ ({
          rules: {
            '@typescript-eslint/consistent-type-imports': 'off',
            'import/consistent-type-specifier-style': 'off',
          },
        }),
      ],
      name: 'recommended without consistent type imports',
      options: { consistentTypeImports: false },
    },
    {
      expected: () => [],
      name: 'recommended without Markdown',
      options: { markdown: false },
    },
  ])(
    'resolves like createBaseConfig: $name',
    { timeout: 60_000 },
    async ({ expected, options }) => {
      const recommended =
        'markdown' in options
          ? configs.recommended.filter(({ name }) => !name?.startsWith('piplup/markdown'))
          : configs.recommended;
      const before = await resolve(
        dir,
        defineConfig(createBaseConfig({ baseDirectory: dir, ...options })),
      );
      const after = await resolve(
        dir,
        defineConfig(ignores(dir), recommended, nodeSupport(dir), ...expected()),
      );
      expect(after).toEqual(before);
    },
  );

  it('keeps the test and docs configs', async () => {
    const before = await resolve(
      dir,
      defineConfig(
        createBaseConfig({ baseDirectory: dir }),
        createTestConfig(),
        createDocsConfig(),
      ),
    );
    const after = await resolve(
      dir,
      defineConfig(
        ignores(dir),
        configs.recommended,
        nodeSupport(dir),
        configs.test,
        docsConfigs.docs,
      ),
    );
    expect(after).toEqual(before);
  }, 60_000);

  it('names every config object', () => {
    for (const [key, value] of Object.entries(configs)) {
      for (const config of value) {
        expect(config.name, `${key}: ${JSON.stringify(Object.keys(config))}`).toBeTruthy();
      }
    }
  });

  it('exposes the configs on the plugin', async () => {
    expect(plugin.configs.recommended).toBe(configs.recommended);
    // Registering the plugin yourself next to the configs is the same object, so no conflict.
    const eslint = new ESLint({
      cwd: dir,
      overrideConfig: defineConfig({ plugins: { piplup: plugin } }, configs.recommended),
      overrideConfigFile: true,
    });
    await expect(eslint.calculateConfigForFile(path.join(dir, 'src/a.ts'))).resolves.toBeTruthy();
  }, 60_000);
});
