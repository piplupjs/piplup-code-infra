import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { globbySync } from 'globby';
import { minimatch } from 'minimatch';

import { configs } from '../eslint/configs/index.mjs';
import { EXTENSION_TEST_FILE } from '../eslint/extensions.mjs';
import { nodeSupport } from '../eslint/node-support.mjs';

/**
 * @typedef {import('eslint').Linter.RuleEntry} RuleEntry
 * @typedef {Record<string, RuleEntry>} Rules
 * @typedef {Record<string, 'readonly' | 'writable' | 'off'>} Globals
 * @typedef {{ files: string[], excludeFiles?: string[], rules?: Rules, globals?: Globals, plugins?: string[], jsPlugins?: JsPlugin[] }} Override
 * @typedef {{ name: string, specifier: string }} JsPlugin
 * @typedef {{
 *   plugins: string[],
 *   jsPlugins: JsPlugin[],
 *   categories: Record<string, 'off'>,
 *   globals: Globals,
 *   settings: Record<string, unknown>,
 *   rules: Rules,
 *   overrides: Override[],
 *   ignorePatterns: string[],
 *   options: { typeAware?: boolean },
 * }} OxlintConfig
 */

const JS_EXTENSIONS = '{js,mjs,cjs,jsx,ts,tsx,mts,cts}';
const TEST_FILES = `**/*.test.${JS_EXTENSIONS}`;
const SAMPLE = '__oxlint_sample__';

/** @type {{ version: string, rules: Record<string, string[]>, typeAware: string[] }} */
const builtin = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL('./builtin-rules.json', import.meta.url)), 'utf8'),
);
const builtinRules = new Set(
  Object.entries(builtin.rules).flatMap(([scope, names]) =>
    names.map((name) => `${scope}/${name}`),
  ),
);
const typeAwareRules = new Set(builtin.typeAware);

/**
 * The oxlint plugins that may implement an ESLint plugin's rules, keyed by the ESLint rule prefix.
 * @type {Record<string, string[]>}
 */
const BUILTIN_SCOPES = {
  '': ['eslint'],
  '@next/next': ['nextjs'],
  '@typescript-eslint': ['typescript', 'eslint'],
  import: ['import'],
  jsdoc: ['jsdoc'],
  'jsx-a11y': ['jsx_a11y'],
  n: ['node'],
  promise: ['promise'],
  react: ['react'],
  'react-hooks': ['react'],
  unicorn: ['unicorn'],
  vitest: ['vitest', 'jest'],
};

/**
 * How an oxlint plugin's rules are named in the config, and its name in `plugins`.
 * @type {Record<string, { prefix: string, plugin?: string }>}
 */
const SCOPE_NAMES = {
  eslint: { prefix: '' },
  import: { plugin: 'import', prefix: 'import/' },
  jest: { plugin: 'jest', prefix: 'jest/' },
  jsdoc: { plugin: 'jsdoc', prefix: 'jsdoc/' },
  jsx_a11y: { plugin: 'jsx-a11y', prefix: 'jsx-a11y/' },
  nextjs: { plugin: 'nextjs', prefix: 'nextjs/' },
  node: { plugin: 'node', prefix: 'node/' },
  promise: { plugin: 'promise', prefix: 'promise/' },
  react: { plugin: 'react', prefix: 'react/' },
  typescript: { plugin: 'typescript', prefix: 'typescript/' },
  unicorn: { plugin: 'unicorn', prefix: 'unicorn/' },
  vitest: { plugin: 'vitest', prefix: 'vitest/' },
};

/**
 * @param {string} relativePath
 * @returns {string}
 */
function modulePath(relativePath) {
  return fileURLToPath(new URL(relativePath, import.meta.url)).replaceAll('\\', '/');
}

/**
 * The ESLint plugins oxlint loads through `jsPlugins` for the rules it doesn't implement, keyed by
 * the ESLint rule prefix. They're the plugin modules the ESLint configs use (../lint/plugins). Where
 * oxlint has a built-in plugin of the same name, the plugin runs under a `-js` name, through an
 * entry module in ./plugins that makes it honor `eslint-disable` comments using the ESLint name.
 * @type {Record<string, { name: string, specifier: string }>}
 */
const JS_PLUGINS = {
  '': { name: 'eslint-js', specifier: modulePath('./plugins/eslint-core.mjs') },
  '@next/next': { name: 'next-js', specifier: modulePath('./plugins/next.mjs') },
  '@typescript-eslint': {
    name: 'typescript-js',
    specifier: modulePath('./plugins/typescript-eslint.mjs'),
  },
  compat: { name: 'compat', specifier: modulePath('../lint/plugins/compat.mjs') },
  import: { name: 'import-js', specifier: modulePath('./plugins/import.mjs') },
  'jsx-a11y': { name: 'jsx-a11y-js', specifier: modulePath('./plugins/jsx-a11y.mjs') },
  n: { name: 'node-js', specifier: modulePath('./plugins/n.mjs') },
  perfectionist: {
    name: 'perfectionist',
    specifier: modulePath('../lint/plugins/perfectionist.mjs'),
  },
  piplup: { name: 'piplup', specifier: modulePath('../eslint/piplup/index.mjs') },
  react: { name: 'react-js', specifier: modulePath('./plugins/react.mjs') },
  'react-compiler': {
    name: 'react-compiler',
    specifier: modulePath('../lint/plugins/react-compiler.mjs'),
  },
  'react-hooks': { name: 'react-hooks-js', specifier: modulePath('./plugins/react-hooks.mjs') },
  'testing-library': {
    name: 'testing-library',
    specifier: modulePath('../lint/plugins/testing-library.mjs'),
  },
  vitest: { name: 'vitest-js', specifier: modulePath('./plugins/vitest.mjs') },
};

/**
 * Rules oxlint implements, but differently enough from the ESLint plugin that the plugin runs
 * instead. oxlint reserves the names of its built-in plugins, so these run under the `-js` name,
 * and `eslint-disable` comments that name the ESLint rule don't apply to them. Keep this list
 * to rules that are rarely disabled.
 */
const PREFER_JS_PLUGIN = new Set([
  // oxlint's version doesn't report a namespace import used only as a type.
  '@typescript-eslint/consistent-type-imports',
  // oxlint's version skips array values, e.g. `role={['admin']}` on a component.
  'jsx-a11y/aria-role',
  // oxlint's version reports the `else` keyword's line instead of the `else` block's.
  'no-else-return',
]);

/** oxlint rules that take no options where the ESLint rule's options are only its defaults. */
const DROP_OPTIONS = new Set(['vitest/no-conditional-expect', 'vitest/no-focused-tests']);

/**
 * @param {string} rule
 * @returns {[prefix: string, name: string]}
 */
function splitRule(rule) {
  const slash = rule.lastIndexOf('/');
  return slash < 0 ? ['', rule] : [rule.slice(0, slash), rule.slice(slash + 1)];
}

/**
 * @param {RuleEntry} entry
 * @returns {boolean}
 */
function isEnabled(entry) {
  const severity = Array.isArray(entry) ? entry[0] : entry;
  return severity !== 0 && severity !== 'off';
}

/**
 * Where oxlint runs an ESLint rule: a built-in rule, or the ESLint plugin's rule loaded through
 * `jsPlugins`.
 * @param {string} rule
 * @returns {{ key: string, plugin?: string, jsPlugin?: string, typeAware?: boolean }}
 */
export function routeRule(rule) {
  const [prefix, name] = splitRule(rule);
  if (!PREFER_JS_PLUGIN.has(rule)) {
    for (const scope of BUILTIN_SCOPES[prefix] ?? []) {
      if (builtinRules.has(`${scope}/${name}`)) {
        const { plugin, prefix: keyPrefix } = SCOPE_NAMES[scope];
        return {
          key: `${keyPrefix}${name}`,
          plugin,
          typeAware: typeAwareRules.has(`${scope}/${name}`),
        };
      }
    }
  }
  const jsPlugin = JS_PLUGINS[prefix]?.name;
  if (!jsPlugin) {
    throw new Error(
      `@piplup/code-infra: no oxlint equivalent for the ESLint rule "${rule}". ` +
        `Add its plugin to JS_PLUGINS in src/oxlint/create-config.mjs.`,
    );
  }
  return { jsPlugin, key: `${jsPlugin}/${name}` };
}

/**
 * @param {Record<string, unknown> | undefined} globals ESLint globals
 * @returns {Globals}
 */
function toOxlintGlobals(globals = {}) {
  return Object.fromEntries(
    Object.entries(globals).map(([name, value]) => {
      if (value === 'off') {
        return [name, 'off'];
      }
      const writable = value === true || value === 'writable' || value === 'writeable';
      return [name, writable ? 'writable' : 'readonly'];
    }),
  );
}

/**
 * @template T
 * @param {Record<string, T>} base
 * @param {Record<string, T>} next
 * @param {T} off
 * @returns {Record<string, T>} What to set on top of `base` to get `next`.
 */
function diff(base, next, off) {
  /** @type {Record<string, T>} */
  const out = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(base[key]) !== JSON.stringify(value)) {
      out[key] = value;
    }
  }
  for (const key of Object.keys(base)) {
    if (!(key in next)) {
      out[key] = off;
    }
  }
  return out;
}

/**
 * @param {string} baseDirectory
 * @returns {string | undefined}
 */
function findReactVersion(baseDirectory) {
  try {
    const require = createRequire(path.join(baseDirectory, 'package.json'));
    return JSON.parse(fs.readFileSync(require.resolve('react/package.json'), 'utf8')).version;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} baseDirectory
 * @returns {boolean}
 */
function hasTypeAwareBackend(baseDirectory) {
  try {
    createRequire(path.join(baseDirectory, 'package.json')).resolve('oxlint-tsgolint/package.json');
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} baseDirectory
 * @returns {string[]}
 */
function readIgnoreFile(baseDirectory) {
  const ignorePath = path.join(baseDirectory, '.lintignore');
  if (!fs.existsSync(ignorePath)) {
    return [];
  }
  return fs
    .readFileSync(ignorePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * @param {string} baseDirectory
 * @returns {string[]} The packages that declare `engines.node`, as the ESLint Node.js support
 * config finds them.
 */
function findNodePackageDirs(baseDirectory) {
  return globbySync('packages*/*/package.json', { cwd: baseDirectory })
    .filter((packageJsonPath) => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(baseDirectory, packageJsonPath), 'utf8'),
      );
      return typeof packageJson.engines?.node === 'string';
    })
    .map((packageJsonPath) => path.posix.dirname(packageJsonPath));
}

/**
 * Builds an oxlint config that runs the same rules, with the same options, as the ESLint config
 * from `@piplup/code-infra/eslint`: `configs.recommended` and `nodeSupport()`, `configs.test` for
 * test files, and `configs.docs` when `docs` is set.
 *
 * oxlint runs a rule natively when it implements it, and otherwise loads the original ESLint
 * plugin through `jsPlugins`. JSON, `package.json` and Markdown files aren't covered: oxlint
 * only lints JavaScript and TypeScript. `code-infra lint` runs both.
 *
 * The rules are read from the ESLint config itself, so the two stay in sync.
 *
 * @param {Object} [options]
 * @param {string} [options.baseDirectory] - The repository root. Defaults to the current directory.
 * @param {boolean} [options.enableReactCompiler] - Add `configs.reactCompiler`.
 * @param {boolean} [options.consistentTypeImports] - Keep `import type` separate, as `configs.typescript`
 * does. Defaults to `true`.
 * @param {{ rootDir?: string } | boolean} [options.docs] - Lint a Next.js docs app like
 * `configs.docs`. `true` uses the `docs` directory. Needs `@next/eslint-plugin-next`.
 * @returns {Promise<OxlintConfig>}
 */
export async function createOxlintConfig({
  baseDirectory = process.cwd(),
  consistentTypeImports = true,
  docs = false,
  enableReactCompiler = false,
} = {}) {
  const docsRootDir = docs ? ((docs === true ? undefined : docs.rootDir) ?? 'docs') : undefined;
  const docsFiles =
    docsRootDir === undefined
      ? undefined
      : path.posix.join(docsRootDir.replaceAll('\\', '/'), `**/*.${JS_EXTENSIONS}`);

  const eslintConfig = defineConfig(
    configs.recommended,
    nodeSupport(baseDirectory),
    enableReactCompiler ? configs.reactCompiler : [],
    consistentTypeImports
      ? []
      : {
          rules: {
            '@typescript-eslint/consistent-type-imports': 'off',
            'import/consistent-type-specifier-style': 'off',
          },
        },
    { extends: [configs.test], files: [`**/*${EXTENSION_TEST_FILE}`] },
    docsFiles
      ? {
          extends: [(await import('../eslint/docs.mjs')).configs.docs],
          files: [docsFiles],
          settings: { next: { rootDir: docsRootDir } },
        }
      : [],
  );
  const eslint = new ESLint({
    cwd: baseDirectory,
    overrideConfig: eslintConfig,
    overrideConfigFile: true,
  });

  // Each category is a set of files ESLint configures differently, with a sample file to ask
  // ESLint about. oxlint applies overrides in order, like ESLint.
  const nodePackageDirs = findNodePackageDirs(baseDirectory);
  /** @type {{ files: string[] | null, excludeFiles?: string[], sample: string }[]} */
  const categories = [
    { files: null, sample: `${SAMPLE}/sample.js` },
    { files: ['**/*.mjs'], sample: `${SAMPLE}/sample.mjs` },
    { files: ['**/*.cjs'], sample: `${SAMPLE}/sample.cjs` },
    { files: ['**/*.jsx'], sample: `${SAMPLE}/sample.jsx` },
    { files: ['**/*.{ts,mts,cts}'], sample: `${SAMPLE}/sample.ts` },
    { files: ['**/*.tsx'], sample: `${SAMPLE}/sample.tsx` },
    { files: ['**/*.d.{ts,mts,cts}'], sample: `${SAMPLE}/sample.d.ts` },
    ...nodePackageDirs.map((dir) => ({
      excludeFiles: [TEST_FILES, `**/*.spec.${JS_EXTENSIONS}`],
      files: [`${dir}/src/**/*.${JS_EXTENSIONS}`],
      sample: `${dir}/src/${SAMPLE}.ts`,
    })),
    { files: [TEST_FILES], sample: `${SAMPLE}/sample.test.tsx` },
    ...(docsRootDir === undefined || !docsFiles
      ? []
      : [
          { files: [docsFiles], sample: path.posix.join(docsRootDir, `${SAMPLE}/sample.tsx`) },
          {
            files: [
              path.posix.join(docsRootDir, `**/*.config.*`),
              path.posix.join(docsRootDir, `**/scripts/**`),
            ],
            sample: path.posix.join(docsRootDir, `scripts/${SAMPLE}.ts`),
          },
        ]),
  ];

  /** @type {Set<string>} */
  const plugins = new Set();
  /** @type {Set<string>} */
  const jsPlugins = new Set();
  let needsTypeAware = false;

  /**
   * @param {Record<string, RuleEntry>} eslintRules
   * @returns {Rules}
   */
  function translateRules(eslintRules) {
    /** @type {Rules} */
    const out = {};
    for (const [rule, entry] of Object.entries(eslintRules)) {
      if (!isEnabled(entry)) {
        continue;
      }
      const route = routeRule(rule);
      if (route.plugin) {
        plugins.add(route.plugin);
      }
      if (route.jsPlugin) {
        jsPlugins.add(route.jsPlugin);
      }
      needsTypeAware ||= Boolean(route.typeAware);
      // Two ESLint rules can map to one oxlint rule, e.g. `no-unused-vars` and
      // `@typescript-eslint/no-unused-vars`. ESLint never enables both for a file.
      out[route.key] =
        DROP_OPTIONS.has(route.key) && Array.isArray(entry) ? entry[0] : /** @type {any} */ (entry);
    }
    return out;
  }

  /** @type {{ files: string[] | null, excludeFiles?: string[], rules: Rules, globals: Globals }[]} */
  const resolved = [];
  /** @type {Record<string, unknown>} */
  let settings = {};
  for (const category of categories) {
    // eslint-disable-next-line no-await-in-loop -- one ESLint instance, cached config
    const config = await eslint.calculateConfigForFile(category.sample);
    if (!config) {
      throw new Error(
        `@piplup/code-infra: ESLint ignores "${category.sample}", so its oxlint rules can't be worked out.`,
      );
    }
    if (category.files === null) {
      settings = config.settings ?? {};
    }
    resolved.push({
      excludeFiles: category.excludeFiles,
      files: category.files,
      globals: toOxlintGlobals(config.languageOptions?.globals),
      rules: translateRules(config.rules ?? {}),
    });
  }

  const [root, ...rest] = resolved;
  /** @type {Override[]} */
  const overrides = [];
  rest.forEach((category, index) => {
    const sample = categories[index + 1].sample;
    // What oxlint would apply to the sample without this override.
    /** @type {Rules} */
    const rules = { ...root.rules };
    /** @type {Globals} */
    const globals = { ...root.globals };
    for (const override of overrides) {
      const matches =
        override.files.some((glob) => minimatch(sample, glob, { dot: true })) &&
        !override.excludeFiles?.some((glob) => minimatch(sample, glob, { dot: true }));
      if (matches) {
        Object.assign(rules, override.rules);
        Object.assign(globals, override.globals);
      }
    }
    const ruleDiff = diff(
      Object.fromEntries(Object.entries(rules).filter(([, entry]) => isEnabled(entry))),
      category.rules,
      /** @type {RuleEntry} */ ('off'),
    );
    const globalsDiff = diff(globals, category.globals, /** @type {Globals[string]} */ ('off'));
    if (Object.keys(ruleDiff).length === 0 && Object.keys(globalsDiff).length === 0) {
      return;
    }
    overrides.push({
      files: /** @type {string[]} */ (category.files),
      ...(category.excludeFiles ? { excludeFiles: category.excludeFiles } : {}),
      ...(Object.keys(ruleDiff).length > 0 ? { rules: ruleDiff } : {}),
      ...(Object.keys(globalsDiff).length > 0 ? { globals: globalsDiff } : {}),
    });
  });

  const reactVersion = findReactVersion(baseDirectory);
  /** @type {any} */
  const reactSettings = settings.react ?? {};
  const { version: reactVersionSetting, ...otherReactSettings } = reactSettings;

  if (needsTypeAware && !hasTypeAwareBackend(baseDirectory)) {
    console.warn(
      '@piplup/code-infra: some rules need type information. Install `oxlint-tsgolint` to run them.',
    );
  }

  return {
    // Only the rules listed below run.
    categories: { correctness: 'off' },
    globals: root.globals,
    ignorePatterns: readIgnoreFile(baseDirectory),
    jsPlugins: Object.values(JS_PLUGINS).filter(({ name }) => jsPlugins.has(name)),
    options: needsTypeAware && hasTypeAwareBackend(baseDirectory) ? { typeAware: true } : {},
    overrides,
    plugins: [...plugins].sort(),
    rules: root.rules,
    settings: {
      ...settings,
      react: {
        ...otherReactSettings,
        ...(reactVersionSetting && reactVersionSetting !== 'detect'
          ? { version: reactVersionSetting }
          : reactVersion && { version: reactVersion }),
      },
      ...(docsRootDir === undefined ? {} : { next: { rootDir: docsRootDir } }),
    },
  };
}
