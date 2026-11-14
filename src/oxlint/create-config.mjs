import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { globbySync } from 'globby';
import { minimatch } from 'minimatch';

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
export const DROP_OPTIONS = new Set(['vitest/no-conditional-expect', 'vitest/no-focused-tests']);

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
    if (!Object.hasOwn(next, key)) {
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

const CODE_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts'];
const MATCH_OPTIONS = { dot: true };

/**
 * @typedef {{ rules: Rules, globals: Globals }} Applied
 * @typedef {{ files: string[], excludeFiles?: string[] }} Target
 */

/**
 * @param {string} file
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesGlob(file, pattern) {
  return minimatch(file, pattern, MATCH_OPTIONS);
}

/**
 * @param {string} file
 * @param {Target} target
 * @returns {boolean}
 */
function matchesTarget(file, target) {
  return (
    target.files.some((pattern) => matchesGlob(file, pattern)) &&
    !target.excludeFiles?.some((pattern) => matchesGlob(file, pattern))
  );
}

/**
 * Expands `{a,b}`, `?(a|b)`, `@(a|b)` and `[ab]` into separate patterns, so oxlint gets plain
 * globs whatever syntax its matcher supports.
 * @param {string} pattern
 * @returns {string[]}
 */
export function expandGlob(pattern) {
  const match = /([?@])\(([^()]*)\)|\{([^{}]*)\}|\[([^\]!^-]+)\]/.exec(pattern);
  if (!match) {
    return [pattern];
  }
  /** @type {string[]} */
  let alternatives;
  if (match[2] !== undefined) {
    alternatives = [...(match[1] === '?' ? [''] : []), ...match[2].split('|')];
  } else if (match[3] === undefined) {
    alternatives = [...match[4]];
  } else {
    alternatives = match[3].split(',');
  }
  const before = pattern.slice(0, match.index);
  const after = pattern.slice(match.index + match[0].length);
  return [
    ...new Set(alternatives.flatMap((alternative) => expandGlob(before + alternative + after))),
  ];
}

/**
 * Whether oxlint lints a file: JavaScript or TypeScript, and not a code block that
 * eslint-plugin-mdx extracts from a Markdown file, like `README.md/0.js`.
 * @param {string} file
 * @returns {boolean}
 */
function isCodeFile(file) {
  const segments = file.split('/');
  const extension = /\.([^./]+)$/.exec(segments.at(-1) ?? '')?.[1];
  return (
    extension !== undefined &&
    CODE_EXTENSIONS.includes(extension) &&
    !segments.slice(0, -1).some((segment) => /\.mdx?$/.test(segment))
  );
}

/**
 * Whether a pattern can match a file oxlint lints. Patterns for JSON files or Markdown code blocks
 * can't.
 * @param {string} pattern
 * @returns {boolean}
 */
function isCodePattern(pattern) {
  const segments = pattern.split('/');
  const extension = /\.([\w-]+)$/.exec(segments.at(-1) ?? '')?.[1];
  return (
    (extension === undefined || CODE_EXTENSIONS.includes(extension)) &&
    !segments.slice(0, -1).some((segment) => /\.mdx?$/.test(segment))
  );
}

/**
 * Whether a pattern matches every JavaScript and TypeScript file, like the `files` of the code
 * configs. ESLint combines it with a narrower pattern when a config extends one of them.
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesAllCode(pattern) {
  return CODE_EXTENSIONS.every(
    (extension) =>
      matchesGlob(`sample.${extension}`, pattern) &&
      matchesGlob(`a/b/sample.${extension}`, pattern),
  );
}

/**
 * The files an ESLint config object applies to, as oxlint `files` and `excludeFiles`.
 * @param {import('eslint').Linter.Config} config
 * @returns {Required<Target> | 'all' | 'none' | 'unsupported'} `all` for every JavaScript and
 * TypeScript file, `none` for none of them, and `unsupported` for what oxlint can't express, such
 * as a function, or an intersection of two narrow patterns.
 */
function toTarget(config) {
  const excludeFiles = (config.ignores ?? [])
    .filter((pattern) => typeof pattern === 'string' && !pattern.startsWith('!'))
    .flatMap((pattern) => expandGlob(/** @type {string} */ (pattern)));
  /** @type {Required<Target> | 'all'} */
  const all = excludeFiles.length > 0 ? { excludeFiles, files: ['**/*'] } : 'all';
  if (!config.files) {
    return all;
  }
  /** @type {string[]} */
  const patterns = [];
  for (const entry of /** @type {unknown[]} */ (config.files)) {
    // An array matches the files that all of its patterns match.
    const parts = (Array.isArray(entry) ? entry : [entry]).filter(
      (part) => typeof part !== 'string' || !matchesAllCode(part),
    );
    if (parts.length === 0) {
      return all;
    }
    if (parts.length > 1 || typeof parts[0] !== 'string') {
      return 'unsupported';
    }
    patterns.push(...expandGlob(parts[0]).filter(isCodePattern));
  }
  return patterns.length > 0 ? { excludeFiles, files: [...new Set(patterns)] } : 'none';
}

/**
 * Made-up files a pattern matches, one per code extension it allows, so ESLint can be asked about
 * files the repository doesn't have yet.
 * @param {string} pattern
 * @returns {string[]}
 */
function samplesFor(pattern) {
  const base = pattern
    .replace(/^\.?\//, '')
    .replaceAll('**', SAMPLE)
    .replaceAll('*', 'sample')
    .replaceAll('?', 's');
  return CODE_EXTENSIONS.flatMap((extension) => [
    base,
    `${base}.${extension}`,
    `${base}/sample.${extension}`,
    base.replace(/\.sample$/, `.${extension}`),
  ]).filter((file) => isCodeFile(file) && matchesGlob(file, pattern));
}

/**
 * @param {string} pattern
 * @returns {string} The leading directories without glob characters, e.g. `docs` for `docs/**`.
 */
function literalPrefix(pattern) {
  const segments = pattern.split('/');
  const index = segments.findIndex((segment) => /[*?{[(]/.test(segment));
  return segments.slice(0, index < 0 ? -1 : index).join('/');
}

/**
 * Translates an ESLint config into an oxlint config, without what depends on the project. See
 * `createOxlintConfig`.
 * @param {Parameters<typeof defineConfig>[number]} eslintConfig
 * @param {Object} options
 * @param {string} options.baseDirectory
 * @param {boolean} [options.scanFiles] - Ask ESLint about the repository's files too, and list the
 * ones the overrides get wrong. Off for configs that don't belong to a repository, like presets.
 * @returns {Promise<OxlintConfig>}
 */
export async function translateConfig(eslintConfig, { baseDirectory, scanFiles = true }) {
  const flatConfig = defineConfig(eslintConfig);
  const eslint = new ESLint({
    cwd: baseDirectory,
    overrideConfig: flatConfig,
    overrideConfigFile: true,
  });

  // The files that config objects with rules or globals apply to, in order, with the rules and
  // globals they set. A run of objects for the same files is one target. Objects for every file
  // are targets too, since they can undo what an earlier, narrower object set.
  /** @type {(Required<Target> & { rules: Set<string>, globals: Set<string> })[]} */
  const targets = [];
  /** @type {string[]} */
  const ignorePatterns = [];
  for (const config of flatConfig) {
    const keys = Object.keys(config).filter((key) => key !== 'name');
    if (keys.length === 1 && keys[0] === 'ignores') {
      ignorePatterns.push(
        ...(config.ignores ?? []).filter((pattern) => typeof pattern === 'string'),
      );
      continue;
    }
    if (!config.rules && !config.languageOptions?.globals) {
      continue;
    }
    const found = toTarget(config);
    if (found === 'none' || found === 'unsupported') {
      continue;
    }
    const target = found === 'all' ? { excludeFiles: [], files: ['**/*'] } : found;
    const rules = Object.keys(config.rules ?? {}).flatMap((rule) => {
      try {
        return [routeRule(rule).key];
      } catch {
        // Only a rule that's turned off can lack a route; building the config fails on others.
        return [];
      }
    });
    const globals = Object.keys(config.languageOptions?.globals ?? {});
    const last = targets.at(-1);
    if (
      last &&
      JSON.stringify([last.files, last.excludeFiles]) ===
        JSON.stringify([target.files, target.excludeFiles])
    ) {
      rules.forEach((rule) => last.rules.add(rule));
      globals.forEach((name) => last.globals.add(name));
    } else {
      targets.push({ ...target, globals: new Set(globals), rules: new Set(rules) });
    }
  }

  // The files to ask ESLint about: made-up ones for each target, and the repository's own.
  const samples = new Set(CODE_EXTENSIONS.map((extension) => `${SAMPLE}/sample.${extension}`));
  for (const target of targets) {
    for (const pattern of target.files.filter((glob) => glob !== '**/*')) {
      const prefix = literalPrefix(pattern);
      for (const samplePattern of [
        pattern,
        ...target.excludeFiles,
        // Excluded files inside the target's directory, like `docs/scripts/*` for `docs/**`.
        ...(prefix ? target.excludeFiles.map((exclude) => `${prefix}/${exclude}`) : []),
      ]) {
        for (const file of samplesFor(samplePattern)) {
          samples.add(file);
        }
      }
    }
  }
  const repositoryFiles = scanFiles
    ? globbySync(`**/*.${JS_EXTENSIONS}`, {
        cwd: baseDirectory,
        dot: true,
        gitignore: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      })
    : [];
  for (const file of repositoryFiles) {
    samples.add(file);
  }

  /** @type {Set<string>} */
  const plugins = new Set();
  /** @type {Set<string>} */
  const jsPlugins = new Set();

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
      // Two ESLint rules can map to one oxlint rule, e.g. `no-unused-vars` and
      // `@typescript-eslint/no-unused-vars`. ESLint never enables both for a file.
      out[route.key] =
        DROP_OPTIONS.has(route.key) && Array.isArray(entry) ? entry[0] : /** @type {any} */ (entry);
    }
    return out;
  }

  // What ESLint applies to each file, translated once per distinct ESLint config. ESLint returns
  // the same object for files that the same config objects match.
  /** @type {Map<object, Applied>} */
  const translations = new Map();
  /** @type {Map<string, Applied>} */
  const expected = new Map();
  /** @type {Record<string, unknown>} */
  const settings = {};
  for (const file of samples) {
    // eslint-disable-next-line no-await-in-loop -- one ESLint instance, cached configs
    const config = (await eslint.isPathIgnored(file))
      ? undefined
      : // eslint-disable-next-line no-await-in-loop -- as above
        await eslint.calculateConfigForFile(file);
    if (!config) {
      continue;
    }
    let translation = translations.get(config);
    if (!translation) {
      translation = {
        globals: toOxlintGlobals(config.languageOptions?.globals),
        rules: translateRules(config.rules ?? {}),
      };
      translations.set(config, translation);
      // oxlint has no settings per file. Plugins read only their own key, so a key set for some
      // files does no harm to the others. The made-up files come first, so a key set for all
      // files wins.
      for (const [key, value] of Object.entries(config.settings ?? {})) {
        if (!Object.hasOwn(settings, key)) {
          settings[key] = value;
        }
      }
    }
    expected.set(file, translation);
  }
  // Files that the same targets match and ESLint configures the same way get the same oxlint
  // config, so one file stands for each such group.
  /** @type {Map<string, { file: string, matched: number[], files: string[] }>} */
  const groups = new Map();
  /** @type {Map<Applied, number>} */
  const translationIds = new Map();
  for (const [file, translation] of expected) {
    const matched = targets.flatMap((target, index) =>
      matchesTarget(file, target) ? [index] : [],
    );
    if (!translationIds.has(translation)) {
      translationIds.set(translation, translationIds.size);
    }
    const key = `${matched.join(',')}|${translationIds.get(translation)}`;
    const group = groups.get(key);
    if (group) {
      group.files.push(file);
    } else {
      groups.set(key, { file, files: [file], matched });
    }
  }

  /** The top-level rules and globals, which apply to all files before the overrides. */
  /** @type {Applied} */
  let root = { globals: {}, rules: {} };
  /** @type {Override[]} */
  const overrides = [];

  /**
   * @param {string} file
   * @returns {Applied} The enabled rules and the globals oxlint applies to the file so far.
   */
  function applied(file) {
    const rules = { ...root.rules };
    const globals = { ...root.globals };
    for (const override of overrides) {
      if (matchesTarget(file, override)) {
        Object.assign(rules, override.rules);
        Object.assign(globals, override.globals);
      }
    }
    return {
      globals,
      rules: Object.fromEntries(Object.entries(rules).filter(([, entry]) => isEnabled(entry))),
    };
  }

  /**
   * The values to set for a rule or global. Where the files need different values, the one most
   * of them need.
   * @template T
   * @param {{ current: Record<string, T>, wanted: Record<string, T>, weight: number }[]} states
   * @param {string} key
   * @param {T} off
   * @returns {{ value: T } | undefined} Nothing when the files already have what they need.
   */
  function agreedValue(states, key, off) {
    /** @type {Map<string, { count: number, value: T }>} */
    const votes = new Map();
    let changed = false;
    for (const { current, wanted, weight } of states) {
      const value = Object.hasOwn(wanted, key) ? wanted[key] : off;
      const vote = JSON.stringify(value);
      changed ||= vote !== JSON.stringify(Object.hasOwn(current, key) ? current[key] : off);
      votes.set(vote, { count: (votes.get(vote)?.count ?? 0) + weight, value });
    }
    if (!changed) {
      return undefined;
    }
    return [...votes.values()].reduce((best, vote) => (vote.count > best.count ? vote : best));
  }

  /**
   * What to set for files on top of what oxlint applies to them so far. Each rule and global is
   * worked out from the files for which `isLast` says this is the last place it's set, as later
   * config objects win in ESLint.
   * @param {Set<string> | undefined} keys - The rules and globals to consider; all by default.
   * @param {(group: { matched: number[] }, kind: 'rules' | 'globals', key: string) => boolean} isLast
   * @param {{ file: string, files: string[], matched: number[] }[]} candidates
   * @returns {Applied}
   */
  function changesFor(keys, isLast, candidates) {
    const states = candidates.map((group) => ({
      group,
      now: applied(group.file),
      want: /** @type {Applied} */ (expected.get(group.file)),
      weight: group.files.length,
    }));
    /** @type {Applied} */
    const changes = { globals: {}, rules: {} };
    for (const kind of /** @type {const} */ (['rules', 'globals'])) {
      const kindKeys =
        keys ??
        new Set(
          states.flatMap(({ now, want }) => [
            ...Object.keys(now[kind]),
            ...Object.keys(want[kind]),
          ]),
        );
      for (const key of kindKeys) {
        const agreed = agreedValue(
          states
            .filter(({ group }) => isLast(group, kind, key))
            .map(({ now, want, weight }) => ({ current: now[kind], wanted: want[kind], weight })),
          key,
          /** @type {any} */ ('off'),
        );
        if (agreed) {
          changes[kind][key] = /** @type {any} */ (agreed.value);
        }
      }
    }
    return changes;
  }

  /**
   * Adds an override for the target, if the files it's the last target for need one.
   * @param {Target & { rules?: Set<string>, globals?: Set<string> }} target
   * @param {Parameters<typeof changesFor>[1]} isLast
   * @param {Parameters<typeof changesFor>[2]} candidates
   */
  function addOverride(target, isLast, candidates) {
    const { globals, rules } = {
      globals: changesFor(target.globals, isLast, candidates).globals,
      rules: changesFor(target.rules, isLast, candidates).rules,
    };
    if (Object.keys(rules).length === 0 && Object.keys(globals).length === 0) {
      return;
    }
    overrides.push({
      files: target.files,
      ...(target.excludeFiles?.length ? { excludeFiles: target.excludeFiles } : {}),
      ...(Object.keys(rules).length > 0 ? { rules } : {}),
      ...(Object.keys(globals).length > 0 ? { globals } : {}),
    });
  }

  /**
   * @param {{ matched: number[] }} group
   * @param {'rules' | 'globals'} kind
   * @param {string} key
   * @returns {number} The last target that sets the rule or global for the group, or -1.
   */
  function lastTarget(group, kind, key) {
    return group.matched.reduce(
      (last, matched) => (targets[matched][kind].has(key) ? matched : last),
      -1,
    );
  }

  // The top-level rules: what the files need where the last config to set a rule applies to all
  // files. Overrides then change what narrower configs set.
  const allGroups = [...groups.values()];
  const topLevel = changesFor(
    undefined,
    (group, kind, key) => {
      const last = targets[lastTarget(group, kind, key)];
      return !last || (last.files.join() === '**/*' && last.excludeFiles.length === 0);
    },
    allGroups,
  );
  root = {
    globals: Object.fromEntries(
      Object.entries(topLevel.globals).filter(([, value]) => value !== 'off'),
    ),
    rules: Object.fromEntries(
      Object.entries(topLevel.rules).filter(([, entry]) => isEnabled(entry)),
    ),
  };

  targets.forEach((target, index) => {
    addOverride(
      target,
      (group, kind, key) => lastTarget(group, kind, key) === index,
      allGroups.filter((group) => group.matched.includes(index)),
    );
  });

  // Repository files the overrides get wrong, for example because a config's `files` is a
  // function, get an override that lists them, grouped by what they still need.
  const repositoryFileSet = new Set(repositoryFiles);
  /** @type {Map<string, { file: string, files: string[], matched: number[] }>} */
  const leftovers = new Map();
  for (const group of allGroups) {
    const files = group.files.filter((file) => repositoryFileSet.has(file));
    if (files.length > 0) {
      const now = applied(group.file);
      const want = /** @type {Applied} */ (expected.get(group.file));
      const needs = JSON.stringify([
        diff(now.rules, want.rules, /** @type {RuleEntry} */ ('off')),
        diff(now.globals, want.globals, /** @type {Globals[string]} */ ('off')),
      ]);
      if (needs !== '[{},{}]') {
        const leftover = leftovers.get(needs);
        if (leftover) {
          leftover.files.push(...files);
        } else {
          leftovers.set(needs, { file: group.file, files, matched: group.matched });
        }
      }
    }
  }
  for (const leftover of leftovers.values()) {
    addOverride({ files: leftover.files.sort() }, () => true, [leftover]);
  }

  return {
    // Only the rules listed below run.
    categories: { correctness: 'off' },
    globals: root.globals,
    ignorePatterns,
    jsPlugins: Object.values(JS_PLUGINS).filter(({ name }) => jsPlugins.has(name)),
    options: {},
    overrides,
    plugins: [...plugins].sort(),
    rules: root.rules,
    settings,
  };
}

/**
 * @param {string} key - An oxlint rule name, like `typescript/no-deprecated`.
 * @returns {boolean} Whether the rule needs type information.
 */
function isTypeAware(key) {
  for (const [scope, { prefix }] of Object.entries(SCOPE_NAMES)) {
    if (prefix ? key.startsWith(prefix) : !key.includes('/')) {
      if (typeAwareRules.has(`${scope}/${key.slice(prefix.length)}`)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Adds what depends on the project rather than on the ESLint config: the React version, which
 * oxlint can't detect, and type-aware linting when `oxlint-tsgolint` is installed and a rule
 * needs it.
 * @template {Partial<OxlintConfig>} T
 * @param {T} config - A whole config, or a preset that adds to one.
 * @param {string} baseDirectory
 * @returns {T}
 */
export function finalizeConfig(config, baseDirectory) {
  /** @type {any} */
  const { version, ...reactSettings } = config.settings?.react ?? {};
  const reactVersion = version && version !== 'detect' ? version : findReactVersion(baseDirectory);
  const needsTypeAware = [
    config.rules ?? {},
    ...(config.overrides ?? []).map(({ rules }) => rules ?? {}),
  ].some((rules) =>
    Object.entries(rules).some(([key, entry]) => isEnabled(entry) && isTypeAware(key)),
  );
  const typeAware = needsTypeAware && hasTypeAwareBackend(baseDirectory);
  if (needsTypeAware && !typeAware) {
    console.warn(
      '@piplup/code-infra: some rules need type information. Install `oxlint-tsgolint` to run them.',
    );
  }
  return {
    ...config,
    ...(config.options || typeAware
      ? { options: { ...config.options, ...(typeAware ? { typeAware: true } : {}) } }
      : {}),
    ...(config.settings
      ? {
          settings: {
            ...config.settings,
            // Only where the config has React settings, so a preset that adds rules for some
            // files doesn't repeat them.
            ...(config.settings.react
              ? { react: { ...reactSettings, ...(reactVersion ? { version: reactVersion } : {}) } }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Builds an oxlint config that runs the same rules, with the same options, as an ESLint flat
 * config, for example one built from `configs.recommended` of `@piplup/code-infra/eslint`.
 *
 * oxlint runs a rule natively when it implements it, and otherwise loads the original ESLint
 * plugin through `jsPlugins`. JSON, `package.json` and Markdown files aren't covered: oxlint
 * only lints JavaScript and TypeScript.
 *
 * ESLint config objects for some of the files become oxlint `overrides`, from their `files` and
 * `ignores`. Each distinct set of files is worked out once, by asking ESLint about files it
 * matches: made-up ones, and the repository's own. Repository files whose rules the overrides
 * don't reproduce, for example because a config's `files` is a function, get an override that
 * lists them.
 *
 * @param {Parameters<typeof defineConfig>[number]} eslintConfig - The ESLint config: what
 * `defineConfig` takes, so it may nest arrays and use `extends`.
 * @param {Object} [options]
 * @param {string} [options.baseDirectory] - The repository root, which file patterns are relative
 * to. Defaults to the current directory.
 * @returns {Promise<OxlintConfig>}
 */
export async function createOxlintConfig(eslintConfig, { baseDirectory = process.cwd() } = {}) {
  return finalizeConfig(await translateConfig(eslintConfig, { baseDirectory }), baseDirectory);
}
