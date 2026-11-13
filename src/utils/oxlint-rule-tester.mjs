/**
 * Stands in for ESLint's and typescript-eslint's `RuleTester` in the `oxlint-rules` test project
 * (vite.config.mts), so the piplup rule tests also run inside oxlint.
 */
import { RuleTester as OxlintRuleTester } from 'oxlint/plugins-dev';
import { afterAll, describe, it } from 'vitest';

OxlintRuleTester.describe = describe;
OxlintRuleTester.it = it;
// @ts-expect-error -- not in the type definitions, but used when present
OxlintRuleTester.afterAll = afterAll;

/**
 * oxlint parses with its own parser, which needs no parser or TypeScript project options.
 * @param {any} [config]
 * @returns {any}
 */
function toOxlintConfig(config = {}) {
  const { languageOptions = {}, ...rest } = config;
  const { parser, parserOptions = {}, ...languageRest } = languageOptions;
  const { projectService, tsconfigRootDir, project, ecmaFeatures, ...parserRest } = parserOptions;
  return {
    // ESLint counts columns from 1, oxlint from 0.
    eslintCompat: true,
    ...rest,
    languageOptions: { ...languageRest, parserOptions: { lang: 'tsx', ...parserRest } },
  };
}

/**
 * typescript-eslint's `RuleTester` takes every pass of a multi-pass fix as `output`. oxlint's
 * applies one pass, so it checks the first.
 * @param {any} test
 * @returns {any}
 */
function toOxlintCase(test) {
  return typeof test === 'object' && Array.isArray(test.output)
    ? { ...test, output: test.output[0] }
    : test;
}

export class RuleTester extends OxlintRuleTester {
  /** @param {any} [config] */
  constructor(config) {
    super(toOxlintConfig(config));
  }

  /**
   * @param {string} name
   * @param {any} rule
   * @param {{ valid: any[], invalid: any[] }} tests
   */
  run(name, rule, { valid, invalid }) {
    super.run(name, rule, { valid, invalid: invalid.map(toOxlintCase) });
  }
}

export default { RuleTester };
