import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

import { createOxfmtConfig } from './oxfmt.mjs';
import { config, docsOverrides } from './prettier.mjs';

const require = createRequire(import.meta.url);
const oxfmtBin = path.join(path.dirname(require.resolve('oxfmt/package.json')), 'bin', 'oxfmt');
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = fileURLToPath(new URL('./__fixtures__/oxfmt', import.meta.url));

/**
 * @param {string} dir
 * @returns {Promise<string>} The path of the written config.
 */
async function writeOxfmtConfig(dir) {
  const configPath = path.join(dir, '.oxfmtrc.json');
  await fs.writeFile(configPath, JSON.stringify(createOxfmtConfig()));
  return configPath;
}

describe('createOxfmtConfig', () => {
  it('formats like the Prettier config', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxfmt-parity-'));
    try {
      const files = await fs.readdir(fixtureDir);
      const prettierConfig = config;
      /** @type {Record<string, string>} */
      const expected = {};
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop -- few small files
        const source = await fs.readFile(path.join(fixtureDir, file), 'utf8');
        // eslint-disable-next-line no-await-in-loop
        expected[file] = await prettier.format(source, { ...prettierConfig, filepath: file });
        // eslint-disable-next-line no-await-in-loop
        await fs.writeFile(path.join(dir, file), source);
      }
      const configPath = await writeOxfmtConfig(dir);
      execFileSync(process.execPath, [oxfmtBin, '-c', configPath, '--write', ...files], {
        cwd: dir,
      });
      for (const file of files) {
        // Sanity check: the fixture really was unformatted.
        // eslint-disable-next-line no-await-in-loop
        expect(await fs.readFile(path.join(fixtureDir, file), 'utf8')).not.toBe(expected[file]);
        // eslint-disable-next-line no-await-in-loop
        expect(await fs.readFile(path.join(dir, file), 'utf8'), file).toBe(expected[file]);
      }
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 60_000);

  it('carries over the options of the Prettier config it gets', () => {
    const own = {
      ...config,
      overrides: [...config.overrides, ...docsOverrides],
      plugins: ['prettier-plugin-tailwindcss'],
      semi: false,
    };
    const oxfmtConfig = createOxfmtConfig(own);
    expect(oxfmtConfig).toMatchObject({ overrides: own.overrides, printWidth: 100, semi: false });
    // oxfmt can't load Prettier plugins.
    expect(oxfmtConfig).not.toHaveProperty('plugins');
  });

  it("leaves this repository's Prettier-formatted files unchanged", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxfmt-check-'));
    try {
      const configPath = await writeOxfmtConfig(dir);
      const result = spawnSync(
        process.execPath,
        [oxfmtBin, '-c', configPath, '--check', '--ignore-path', '.lintignore', '.'],
        { cwd: repoRoot, encoding: 'utf8' },
      );
      expect(result.stdout + result.stderr).not.toMatch(/Format issues found/);
      expect(result.status).toBe(0);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 60_000);
});
