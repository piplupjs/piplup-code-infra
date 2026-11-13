import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { finalizeConfig } from './create-config.mjs';

/**
 * @typedef {Partial<import('./create-config.mjs').OxlintConfig>} Preset
 */

/**
 * Reads a preset from ./presets, written by `pnpm oxlint:presets`, and adds what depends on the
 * project in the current directory: the React version and type-aware linting.
 * @param {string} file
 * @returns {Preset}
 */
function loadPreset(file) {
  /** @type {Preset} */
  const preset = JSON.parse(
    fs.readFileSync(fileURLToPath(new URL(`./presets/${file}`, import.meta.url)), 'utf8'),
  );
  return finalizeConfig(
    {
      ...preset,
      ...(preset.jsPlugins
        ? {
            jsPlugins: preset.jsPlugins.map(({ name, specifier }) => ({
              name,
              specifier: fileURLToPath(new URL(specifier, import.meta.url)).replaceAll('\\', '/'),
            })),
          }
        : {}),
    },
    process.cwd(),
  );
}

/** @type {Record<string, Preset>} */
const loaded = {};

/**
 * @param {string} name
 * @param {string} file
 * @returns {Preset}
 */
function preset(name, file) {
  loaded[name] ??= loadPreset(file);
  return loaded[name];
}

/**
 * oxlint configs for `combine()` in `oxlint.config.ts`, with the rules of the ESLint configs of
 * the same names. `recommended` is a whole config; the others add to it, so list them after it.
 * Each is read when first used.
 */
export const presets = {
  /**
   * The rules of `configs.docs` from `@piplup/code-infra/eslint/docs`, for a Next.js app in
   * `docs`. Its type-aware rule runs when `oxlint-tsgolint` is installed.
   */
  get docs() {
    return preset('docs', 'docs.json');
  },
  /** React Compiler's rule, as `configs.reactCompiler` adds it. */
  get reactCompiler() {
    return preset('reactCompiler', 'react-compiler.json');
  },
  /** Every JavaScript and TypeScript rule of the ESLint `configs.recommended`. */
  get recommended() {
    return preset('recommended', 'recommended.json');
  },
  /** The rules of `configs.spec`, for `*.spec.*` files. */
  get spec() {
    return preset('spec', 'spec.json');
  },
  /** The rules of `configs.test`, for `*.test.*` files. */
  get test() {
    return preset('test', 'test.json');
  },
};
