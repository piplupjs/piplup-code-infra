import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { describe, expect, it } from 'vitest';

import { configs } from '../eslint/index.mjs';
import {
  eslintFindings,
  eslintRules,
  oxlintFindings,
  oxlintRules,
} from '../utils/oxlint-parity.mjs';

import { buildPresets, PRESET_FILES, PRESET_SOURCES } from './build-presets.mjs';
import { combine } from './combine.mjs';
import { presets } from './presets.mjs';

const require = createRequire(import.meta.url);
const oxlintBin = path.join(path.dirname(require.resolve('oxlint/package.json')), 'bin', 'oxlint');

describe('oxlint presets', () => {
  it('are up to date with the ESLint configs', async () => {
    const built = await buildPresets();
    expect(Object.keys(built).sort()).toEqual(Object.keys(PRESET_FILES).sort());
    for (const [name, preset] of Object.entries(built)) {
      const file = new URL(
        `./presets/${PRESET_FILES[/** @type {keyof typeof PRESET_FILES} */ (name)]}`,
        import.meta.url,
      );
      // Run `pnpm oxlint:presets` after changing an ESLint config or upgrading oxlint.
      // eslint-disable-next-line no-await-in-loop -- a handful of files
      expect(JSON.parse(await fs.readFile(file, 'utf8')), name).toEqual(preset);
    }
  }, 120_000);

  it('load with plugins that exist and no React version left to detect', async () => {
    for (const preset of Object.values(presets)) {
      for (const { specifier } of preset.jsPlugins ?? []) {
        // eslint-disable-next-line no-await-in-loop -- one at a time keeps failures readable
        await expect(fs.access(specifier)).resolves.toBeUndefined();
      }
    }
    expect(/** @type {any} */ (presets.recommended.settings)?.react?.version).not.toBe('detect');
    expect(presets.test.settings?.react).toBeUndefined();
  });

  it('work in oxlint through `extends`, under the project’s own rules', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-presets-'));
    try {
      await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "presets", "type": "module" }');
      const presetsUrl = pathToFileURL(path.join(import.meta.dirname, 'index.mjs')).href;
      await fs.writeFile(
        path.join(dir, 'oxlint.config.ts'),
        [
          `import { combine, presets } from '${presetsUrl}';`,
          '',
          'export default combine(',
          '  presets.recommended,',
          '  presets.test,',
          '  presets.spec,',
          '  presets.reactCompiler,',
          "  { rules: { 'no-console': 'off' } },",
          ');',
          '',
        ].join('\n'),
      );
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(
        path.join(dir, 'src/a.ts'),
        'var a = 1;\nconsole.log(a);\nexport const o = { z: 1, a: 2 };\n',
      );
      await fs.writeFile(
        path.join(dir, 'src/a.test.ts'),
        "import { it } from 'vitest';\n\nit.only('works', () => {});\n",
      );
      const result = spawnSync(process.execPath, [oxlintBin, '-f', 'unix', 'src'], {
        cwd: dir,
        encoding: 'utf8',
      });
      const findings = result.stdout
        .split('\n')
        .map((line) => line.match(/^(.+?):(\d+):\d+: .*\[\w+\/(.+)\]$/))
        .filter((match) => match !== null)
        .map(([, file, line, rule]) => `${file.replaceAll('\\', '/')}:${line} ${rule}`)
        .sort();
      expect(findings).toEqual([
        'src/a.test.ts:3 vitest(expect-expect)',
        'src/a.test.ts:3 vitest(no-focused-tests)',
        'src/a.ts:1 eslint(no-var)',
        'src/a.ts:3 perfectionist(sort-objects)',
      ]);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 120_000);
});

/** @typedef {keyof typeof presets} PresetName */

/**
 * The ESLint config a list of presets stands for.
 * @param {PresetName[]} names - `recommended` and the presets after it.
 */
function eslintConfigFor(names) {
  return defineConfig(
    configs.recommended,
    ...names.filter((name) => name !== 'recommended').map((name) => PRESET_SOURCES[name]),
  );
}

const FILES = [
  'a.js',
  'src/a.mjs',
  'src/a.cjs',
  'src/a.jsx',
  'src/a.ts',
  'src/a.mts',
  'src/a.tsx',
  'src/a.d.ts',
  'src/a.test.ts',
  'src/a.test.mjs',
  'src/a.spec.ts',
  'src/a.spec.test.ts',
  'docs/a.tsx',
  'docs/pages/a.mjs',
  'docs/a.test.tsx',
  'docs/a.spec.ts',
  'docs/next.config.mjs',
  'docs/scripts/build.ts',
];

describe('oxlint presets, compared with their ESLint configs', () => {
  /** @type {PresetName[][]} */
  const combinations = [
    ['recommended'],
    ['recommended', 'reactCompiler'],
    ['recommended', 'test'],
    ['recommended', 'spec'],
    ['recommended', 'docs'],
    ['recommended', 'reactCompiler', 'test', 'spec', 'docs'],
  ];

  it.each(combinations.map((names) => [names.join(' + '), names]))(
    'enable the rules ESLint does for each kind of file, for %s',
    { timeout: 60_000 },
    async (_label, names) => {
      const eslint = new ESLint({
        overrideConfig: eslintConfigFor(names),
        overrideConfigFile: true,
      });
      const config = combine(...names.map((name) => presets[name]));
      for (const file of FILES) {
        // eslint-disable-next-line no-await-in-loop -- one at a time keeps failures readable
        expect(oxlintRules(config, file), file).toEqual(await eslintRules(eslint, file));
      }
    },
  );

  it('report the same problems as ESLint on the fixture project', async () => {
    const fixtureDir = fileURLToPath(new URL('./__fixtures__/parity', import.meta.url));
    const files = (await fs.readdir(path.join(fixtureDir, 'src'))).map((file) =>
      path.posix.join('src', file),
    );
    const eslint = new ESLint({
      cwd: fixtureDir,
      overrideConfig: eslintConfigFor(['recommended', 'test']),
      overrideConfigFile: true,
    });
    const fromEslint = await eslintFindings(eslint, fixtureDir, files);

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-presets-parity-'));
    /** @type {Set<string>} */
    let fromOxlint;
    try {
      const configPath = path.join(dir, 'oxlint.config.ts');
      const indexUrl = pathToFileURL(path.join(import.meta.dirname, 'index.mjs')).href;
      await fs.writeFile(
        configPath,
        `import { combine, presets } from '${indexUrl}';\n\nexport default combine(presets.recommended, presets.test);\n`,
      );
      fromOxlint = oxlintFindings(configPath, fixtureDir, files);
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }

    expect(fromEslint.size).toBeGreaterThan(25);
    expect({
      onlyEslint: [...fromEslint].filter((item) => !fromOxlint.has(item)),
      onlyOxlint: [...fromOxlint].filter((item) => !fromEslint.has(item)),
    }).toEqual({
      onlyEslint: [],
      // As with `createOxlintConfig`: oxlint matches the comment against its own rule names.
      onlyOxlint: ['src/directives.ts:7 unused-directive'],
    });
  }, 120_000);
});
