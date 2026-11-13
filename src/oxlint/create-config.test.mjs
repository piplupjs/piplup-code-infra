import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configs } from '../eslint/configs/index.mjs';
import { EXTENSION_TEST_FILE } from '../eslint/extensions.mjs';

import { createOxlintConfig, routeRule } from './create-config.mjs';

const require = createRequire(import.meta.url);
const oxlintPackageJsonPath = require.resolve('oxlint/package.json');
const oxlintBin = path.join(path.dirname(oxlintPackageJsonPath), 'bin', 'oxlint');
const fixtureDir = fileURLToPath(new URL('./__fixtures__/parity', import.meta.url));

/**
 * @param {string} file
 * @param {number} line
 * @param {string} rule
 */
function finding(file, line, rule) {
  return `${file.replaceAll('\\', '/')}:${line} ${rule}`;
}

describe('builtin-rules.json', () => {
  it('lists the rules of the installed oxlint', async () => {
    const { version } = JSON.parse(await fs.readFile(oxlintPackageJsonPath, 'utf8'));
    const builtin = JSON.parse(
      await fs.readFile(new URL('./builtin-rules.json', import.meta.url), 'utf8'),
    );
    // Run `node scripts/update-oxlint-rules.mjs` after upgrading oxlint.
    expect(builtin.version).toBe(version);
  });
});

describe('routeRule', () => {
  it('uses a built-in oxlint rule when there is one', () => {
    expect(routeRule('no-var')).toMatchObject({ key: 'no-var' });
    expect(routeRule('@typescript-eslint/no-explicit-any')).toMatchObject({
      key: 'typescript/no-explicit-any',
      plugin: 'typescript',
    });
    // oxlint's core rule also understands TypeScript.
    expect(routeRule('@typescript-eslint/no-unused-vars')).toMatchObject({ key: 'no-unused-vars' });
    expect(routeRule('react-hooks/rules-of-hooks')).toMatchObject({ plugin: 'react' });
  });

  it('loads the ESLint plugin for rules oxlint lacks', () => {
    expect(routeRule('import/order')).toEqual({ jsPlugin: 'import-js', key: 'import-js/order' });
    expect(routeRule('piplup/no-guarded-throw')).toEqual({
      jsPlugin: 'piplup',
      key: 'piplup/no-guarded-throw',
    });
    expect(routeRule('dot-notation')).toMatchObject({ jsPlugin: 'eslint-js' });
  });

  it('throws for a plugin it has no route for', () => {
    expect(() => routeRule('unknown-plugin/rule')).toThrow(/no oxlint equivalent/);
  });
});

describe('createOxlintConfig', () => {
  /** @type {string} */
  let emptyDir;

  beforeAll(async () => {
    emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-config-'));
    await fs.writeFile(path.join(emptyDir, 'package.json'), '{ "name": "empty" }');
  });

  afterAll(async () => {
    await fs.rm(emptyDir, { force: true, recursive: true });
  });

  // Building the config fails on any enabled ESLint rule oxlint can't run, so this covers every
  // rule of every option combination.
  it.each([
    {},
    { enableReactCompiler: true },
    { consistentTypeImports: false },
    { docs: true },
    { docs: { rootDir: '.' } },
  ])('routes every ESLint rule for %j', { timeout: 60_000 }, async (options) => {
    const config = await createOxlintConfig({ baseDirectory: emptyDir, ...options });
    expect(Object.keys(config.rules).length).toBeGreaterThan(150);
    for (const { specifier } of config.jsPlugins) {
      // eslint-disable-next-line no-await-in-loop -- one at a time keeps failures readable
      await expect(fs.access(specifier)).resolves.toBeUndefined();
    }
  });

  it('is accepted by oxlint', async () => {
    const config = await createOxlintConfig({ baseDirectory: emptyDir, docs: true });
    const configPath = path.join(emptyDir, '.oxlintrc.json');
    await fs.writeFile(configPath, JSON.stringify(config));
    await fs.writeFile(path.join(emptyDir, 'a.ts'), 'export const a = 1;\n');
    const result = spawnSync(process.execPath, [oxlintBin, '-c', configPath, 'a.ts'], {
      cwd: emptyDir,
      encoding: 'utf8',
    });
    expect(result.stderr + result.stdout).not.toMatch(/Failed|Invalid configuration|Error/);
    expect(result.status).toBe(0);
  }, 60_000);
});

describe('parity with ESLint', () => {
  it('reports the same problems on the fixture project', async () => {
    const files = (await fs.readdir(path.join(fixtureDir, 'src'))).map((file) =>
      path.posix.join('src', file),
    );

    const eslint = new ESLint({
      cwd: fixtureDir,
      overrideConfig: defineConfig(configs.recommended, {
        extends: [configs.test],
        files: [`**/*${EXTENSION_TEST_FILE}`],
      }),
      overrideConfigFile: true,
    });
    const eslintFindings = new Set();
    for (const result of await eslint.lintFiles(files)) {
      for (const message of result.messages) {
        const rule = message.ruleId ? routeRule(message.ruleId).key : 'unused-directive';
        eslintFindings.add(finding(path.relative(fixtureDir, result.filePath), message.line, rule));
      }
    }

    const config = await createOxlintConfig({ baseDirectory: fixtureDir });
    const configPath = path.join(os.tmpdir(), `oxlint-parity-${process.pid}.json`);
    await fs.writeFile(configPath, JSON.stringify(config));
    /** @type {string} */
    let output;
    try {
      output = execFileSync(
        process.execPath,
        [oxlintBin, '-c', configPath, '-f', 'unix', '--report-unused-disable-directives', ...files],
        { cwd: fixtureDir, encoding: 'utf8' },
      );
    } catch (error) {
      output = /** @type {{ stdout: string }} */ (error).stdout;
    } finally {
      await fs.rm(configPath, { force: true });
    }
    const oxlintFindings = new Set();
    for (const line of output.split('\n')) {
      const match = line.match(/^(.+?):(\d+):\d+: (.*?)(?: \[\w+\/([\w-]+)\(([^)]+)\)\])?$/);
      if (!match) {
        continue;
      }
      const [, file, lineNumber, message, scope, rule] = match;
      let key;
      if (rule) {
        // oxlint labels the React hooks rules of its `react` plugin `react-hooks`.
        const configScope = scope === 'react-hooks' ? 'react' : scope;
        key = configScope === 'eslint' ? rule : `${configScope}/${rule}`;
      } else if (message.startsWith('Unused eslint-disable directive')) {
        key = 'unused-directive';
      } else {
        continue;
      }
      oxlintFindings.add(finding(file, Number(lineNumber), key));
    }

    expect(eslintFindings.size).toBeGreaterThan(25);
    expect({
      onlyEslint: [...eslintFindings].filter((item) => !oxlintFindings.has(item)),
      onlyOxlint: [...oxlintFindings].filter((item) => !eslintFindings.has(item)),
    }).toEqual({
      onlyEslint: [],
      // The comment names `@typescript-eslint/naming-convention`, which oxlint runs as
      // `typescript-js/naming-convention`. The rule honors the comment, but oxlint, which matches
      // comments against its own rule names, still counts it as unused.
      onlyOxlint: ['src/directives.ts:7 unused-directive'],
    });
  }, 120_000);
});
