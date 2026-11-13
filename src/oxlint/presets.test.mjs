import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildPresets, PRESET_FILES } from './build-presets.mjs';
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
          `import { presets } from '${presetsUrl}';`,
          '',
          'export default {',
          '  extends: [presets.recommended, presets.test, presets.spec, presets.reactCompiler],',
          "  rules: { 'no-console': 'off' },",
          '};',
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
