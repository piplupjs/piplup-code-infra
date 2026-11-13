import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configs as docsConfigs } from '../eslint/docs.mjs';
import { EXTENSION_TEST_FILE, EXTENSION_TS } from '../eslint/extensions.mjs';
import { configs } from '../eslint/index.mjs';

import { translateConfig } from './create-config.mjs';

/**
 * @typedef {import('./create-config.mjs').OxlintConfig} OxlintConfig
 * @typedef {Partial<OxlintConfig>} Preset
 */

const OXLINT_DIRECTORY = fileURLToPath(new URL('.', import.meta.url));

/**
 * The ESLint configs the presets reproduce. Each preset after `recommended` holds what its config
 * adds to `recommended`, scoped to the files it's meant for.
 * @type {Record<string, Parameters<typeof translateConfig>[0][]>}
 */
export const PRESET_SOURCES = {
  docs: [{ extends: [docsConfigs.docs], files: [`docs/**/*${EXTENSION_TS}`] }],
  reactCompiler: configs.reactCompiler,
  recommended: [],
  spec: configs.spec,
  test: [{ extends: [configs.test], files: [`**/*${EXTENSION_TEST_FILE}`] }],
};

/** The file each preset is written to, in ./presets. */
export const PRESET_FILES = {
  docs: 'docs.json',
  reactCompiler: 'react-compiler.json',
  recommended: 'recommended.json',
  spec: 'spec.json',
  test: 'test.json',
};

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The values to set on `base` to get `next`, with `off` for the keys `next` lacks.
 * @template T
 * @param {Record<string, T>} base
 * @param {Record<string, T>} next
 * @param {T} off
 * @returns {Record<string, T>}
 */
function changes(base, next, off) {
  /** @type {Record<string, T>} */
  const out = {};
  for (const [key, value] of Object.entries(next)) {
    if (!same(base[key], value)) {
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
 * What `full` adds to `base`, as a config that `extends` can put after `base`. oxlint merges the
 * top-level fields of extended configs, later ones winning, and applies all their overrides in
 * order, so `full` must keep `base`'s overrides and add its own after them.
 * @param {string} name
 * @param {OxlintConfig} base
 * @param {OxlintConfig} full
 * @returns {Preset}
 */
function presetOf(name, base, full) {
  const kept = full.overrides.slice(0, base.overrides.length);
  if (!same(kept, base.overrides)) {
    throw new Error(
      `@piplup/code-infra: the "${name}" preset changes overrides of "recommended", which oxlint's ` +
        '`extends` can only add to.',
    );
  }
  const rules = changes(
    base.rules,
    full.rules,
    /** @type {import('eslint').Linter.RuleEntry} */ ('off'),
  );
  const globals = changes(
    base.globals,
    full.globals,
    /** @type {OxlintConfig['globals'][string]} */ ('off'),
  );
  const settings = changes(base.settings, full.settings, /** @type {unknown} */ (undefined));
  const basePluginNames = new Set(base.jsPlugins.map((plugin) => plugin.name));
  const plugins = full.plugins.filter((plugin) => !base.plugins.includes(plugin));
  const jsPlugins = full.jsPlugins.filter((plugin) => !basePluginNames.has(plugin.name));
  const overrides = full.overrides.slice(base.overrides.length);
  return {
    ...(plugins.length > 0 ? { plugins } : {}),
    ...(jsPlugins.length > 0 ? { jsPlugins } : {}),
    ...(Object.keys(settings).length > 0 ? { settings } : {}),
    ...(Object.keys(globals).length > 0 ? { globals } : {}),
    ...(Object.keys(rules).length > 0 ? { rules } : {}),
    ...(overrides.length > 0 ? { overrides } : {}),
  };
}

/**
 * Points the `jsPlugins` at modules relative to src/oxlint, so the presets don't depend on where
 * the package is installed. `loadPreset` resolves them again.
 * @param {Preset} preset
 * @returns {Preset}
 */
function relativeSpecifiers(preset) {
  if (!preset.jsPlugins) {
    return preset;
  }
  return {
    ...preset,
    jsPlugins: preset.jsPlugins.map(({ name, specifier }) => {
      const relative = path.relative(OXLINT_DIRECTORY, specifier).replaceAll('\\', '/');
      return { name, specifier: relative.startsWith('.') ? relative : `./${relative}` };
    }),
  };
}

/**
 * Builds the oxlint presets from the ESLint configs. They hold nothing that depends on the
 * project; `loadPreset` adds that.
 * @returns {Promise<Record<string, Preset>>}
 */
export async function buildPresets() {
  const baseDirectory = path.resolve(OXLINT_DIRECTORY, '../..');
  /** @param {Parameters<typeof translateConfig>[0][]} extra */
  const translate = (extra) =>
    translateConfig([configs.recommended, ...extra], { baseDirectory, scanFiles: false });
  const base = await translate([]);
  /** @type {Record<string, Preset>} */
  const presets = {};
  for (const [name, source] of Object.entries(PRESET_SOURCES)) {
    presets[name] =
      name === 'recommended'
        ? base
        : // eslint-disable-next-line no-await-in-loop -- one ESLint instance at a time
          presetOf(name, base, await translate(source));
  }
  return Object.fromEntries(
    Object.entries(presets).map(([name, preset]) => [name, relativeSpecifiers(preset)]),
  );
}
