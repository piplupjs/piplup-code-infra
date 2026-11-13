import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { minimatch } from 'minimatch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configs as docsConfigs } from '../eslint/docs.mjs';
import { EXTENSION_TEST_FILE } from '../eslint/extensions.mjs';
import { configs, nodeSupport } from '../eslint/index.mjs';

import { createOxlintConfig, DROP_OPTIONS, expandGlob, routeRule } from './create-config.mjs';

/** @typedef {Parameters<typeof defineConfig>[number]} ConfigWithExtends */

const require = createRequire(import.meta.url);
const oxlintPackageJsonPath = require.resolve('oxlint/package.json');
const oxlintBin = path.join(path.dirname(oxlintPackageJsonPath), 'bin', 'oxlint');
const fixtureDir = fileURLToPath(new URL('./__fixtures__/parity', import.meta.url));

/** @type {ConfigWithExtends} */
const testFiles = { extends: [configs.test], files: [`**/*${EXTENSION_TEST_FILE}`] };

/** @type {ConfigWithExtends} */
const docsFiles = {
  extends: [docsConfigs.docs],
  files: ['docs/**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
  settings: { next: { rootDir: 'docs' } },
};

/**
 * The rules oxlint enables for a file, from the top-level rules and the overrides that match it.
 * @param {Awaited<ReturnType<typeof createOxlintConfig>>} config
 * @param {string} file
 */
function oxlintRules(config, file) {
  const rules = { ...config.rules };
  for (const override of config.overrides) {
    const matches =
      override.files.some((glob) => minimatch(file, glob, { dot: true })) &&
      !override.excludeFiles?.some((glob) => minimatch(file, glob, { dot: true }));
    if (matches) {
      Object.assign(rules, override.rules);
    }
  }
  return normalizeRules(rules);
}

/**
 * The enabled rules, sorted, with severities as names.
 * @param {Record<string, unknown>} rules
 */
function normalizeRules(rules) {
  const names = ['off', 'warn', 'error'];
  /** @param {unknown} severity */
  const name = (severity) => (typeof severity === 'number' ? names[severity] : severity);
  return Object.fromEntries(
    Object.entries(rules)
      .map(([rule, entry]) => [
        rule,
        Array.isArray(entry) ? [name(entry[0]), ...entry.slice(1)] : name(entry),
      ])
      .filter(([, entry]) => (Array.isArray(entry) ? entry[0] : entry) !== 'off')
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

/**
 * The rules ESLint enables for a file, under their oxlint names.
 * @param {ESLint} eslint
 * @param {string} file
 */
async function eslintRules(eslint, file) {
  const config = await eslint.calculateConfigForFile(file);
  return normalizeRules(
    Object.fromEntries(
      Object.entries(config.rules)
        // Turned-off rules may have no oxlint equivalent, and may share one with an enabled rule.
        .filter(([, entry]) => (Array.isArray(entry) ? entry[0] : entry) !== 0)
        .map(([rule, entry]) => {
          const { key } = routeRule(rule);
          // The builder drops options oxlint rejects that only repeat the defaults.
          return [key, DROP_OPTIONS.has(key) && Array.isArray(entry) ? entry[0] : entry];
        }),
    ),
  );
}

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

describe('expandGlob', () => {
  it('expands braces, extglob alternatives and character classes', () => {
    expect(expandGlob('**/*.?(c|m)[jt]s')).toEqual([
      '**/*.js',
      '**/*.ts',
      '**/*.cjs',
      '**/*.cts',
      '**/*.mjs',
      '**/*.mts',
    ]);
    expect(expandGlob('docs/**/*.{md,mdx}')).toEqual(['docs/**/*.md', 'docs/**/*.mdx']);
    expect(expandGlob('src/**')).toEqual(['src/**']);
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

  /** @type {Record<string, ConfigWithExtends[]>} */
  const eslintConfigs = {
    docs: [configs.recommended, testFiles, docsFiles],
    'docs at the root': [
      configs.recommended,
      testFiles,
      { ...docsFiles, files: ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'], settings: {} },
    ],
    'inline type imports': [
      configs.recommended,
      {
        rules: {
          '@typescript-eslint/consistent-type-imports': 'off',
          'import/consistent-type-specifier-style': 'off',
        },
      },
    ],
    'React Compiler': [configs.recommended, configs.reactCompiler, testFiles],
    recommended: [configs.recommended, testFiles],
  };

  // Building the config fails on any enabled ESLint rule oxlint can't run, so this covers every
  // rule of these configs.
  it.each(Object.keys(eslintConfigs))(
    'routes every ESLint rule for %s',
    { timeout: 60_000 },
    async (name) => {
      const config = await createOxlintConfig(eslintConfigs[name], { baseDirectory: emptyDir });
      expect(Object.keys(config.rules).length).toBeGreaterThan(150);
      for (const { specifier } of config.jsPlugins) {
        // eslint-disable-next-line no-await-in-loop -- one at a time keeps failures readable
        await expect(fs.access(specifier)).resolves.toBeUndefined();
      }
    },
  );

  it.each(Object.keys(eslintConfigs))(
    'enables the rules ESLint does for each kind of file, for %s',
    { timeout: 60_000 },
    async (name) => {
      const config = await createOxlintConfig(eslintConfigs[name], { baseDirectory: emptyDir });
      const eslint = new ESLint({
        cwd: emptyDir,
        overrideConfig: defineConfig(eslintConfigs[name]),
        overrideConfigFile: true,
      });
      for (const file of [
        'a.js',
        'src/a.mjs',
        'src/a.cjs',
        'src/a.jsx',
        'src/a.ts',
        'src/a.tsx',
        'src/a.d.ts',
        'src/a.test.ts',
        'src/a.test.mjs',
        'src/a.spec.ts',
        'docs/a.tsx',
        'docs/a.test.tsx',
        'docs/next.config.mjs',
        'docs/scripts/build.ts',
      ]) {
        // eslint-disable-next-line no-await-in-loop -- one at a time keeps failures readable
        expect(oxlintRules(config, file), file).toEqual(await eslintRules(eslint, file));
      }
      // Patterns cover every kind of file, so none needs a list of files.
      expect(config.overrides.every(({ files }) => files.every((glob) => glob.includes('*')))).toBe(
        true,
      );
    },
  );

  it('lists the files whose ESLint config it can only match by name', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-config-'));
    try {
      await fs.writeFile(path.join(dir, 'package.json'), '{ "name": "listed" }');
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(path.join(dir, 'src/special.ts'), 'export {};\n');
      await fs.writeFile(path.join(dir, 'src/plain.ts'), 'export {};\n');
      const config = await createOxlintConfig(
        [
          configs.recommended,
          {
            // ESLint takes functions in `files`, but its types don't say so.
            files: [
              /** @type {any} */ ((/** @type {string} */ file) => file.endsWith('special.ts')),
            ],
            rules: { 'no-console': 'off' },
          },
        ],
        { baseDirectory: dir },
      );
      expect(config.overrides.at(-1)).toEqual({
        files: ['src/special.ts'],
        rules: { 'no-console': 'off' },
      });
      expect(oxlintRules(config, 'src/plain.ts')).toHaveProperty('no-console');
    } finally {
      await fs.rm(dir, { force: true, recursive: true });
    }
  }, 60_000);

  it('takes the ignore patterns from the ESLint config', async () => {
    const config = await createOxlintConfig([{ ignores: ['generated/**'] }, configs.recommended], {
      baseDirectory: emptyDir,
    });
    expect(config.ignorePatterns).toEqual(['generated/**']);
  }, 60_000);

  it('is accepted by oxlint', async () => {
    const config = await createOxlintConfig(eslintConfigs.docs, { baseDirectory: emptyDir });
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

    const eslintConfig = defineConfig(configs.recommended, nodeSupport(fixtureDir), testFiles);
    const eslint = new ESLint({
      cwd: fixtureDir,
      overrideConfig: eslintConfig,
      overrideConfigFile: true,
    });
    const eslintFindings = new Set();
    for (const result of await eslint.lintFiles(files)) {
      for (const message of result.messages) {
        const rule = message.ruleId ? routeRule(message.ruleId).key : 'unused-directive';
        eslintFindings.add(finding(path.relative(fixtureDir, result.filePath), message.line, rule));
      }
    }

    const config = await createOxlintConfig(eslintConfig, { baseDirectory: fixtureDir });
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
