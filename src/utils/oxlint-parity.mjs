/**
 * Helpers for tests that compare oxlint configs with the ESLint configs they come from.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { minimatch } from 'minimatch';

import { DROP_OPTIONS, routeRule } from '../oxlint/create-config.mjs';

/**
 * @typedef {Partial<import('../oxlint/create-config.mjs').OxlintConfig>} OxlintConfig
 */

const require = createRequire(import.meta.url);
export const oxlintBin = path.join(
  path.dirname(require.resolve('oxlint/package.json')),
  'bin',
  'oxlint',
);

/**
 * The enabled rules, sorted, with severities as names.
 * @param {Record<string, unknown>} rules
 * @returns {Record<string, unknown>}
 */
export function normalizeRules(rules) {
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
 * Combines configs as oxlint's `extends` does: later top-level rules win, and every config's
 * overrides apply, in order.
 * @param {OxlintConfig[]} configs
 * @returns {OxlintConfig}
 */
export function mergeOxlintConfigs(configs) {
  return {
    overrides: configs.flatMap((config) => config.overrides ?? []),
    rules: Object.assign({}, ...configs.map((config) => config.rules ?? {})),
  };
}

/**
 * The rules oxlint enables for a file, from the top-level rules and the overrides that match it.
 * @param {OxlintConfig} config
 * @param {string} file
 */
export function oxlintRules(config, file) {
  const rules = { ...config.rules };
  for (const override of config.overrides ?? []) {
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
 * The rules ESLint enables for a file, under their oxlint names.
 * @param {import('eslint').ESLint} eslint
 * @param {string} file
 */
export async function eslintRules(eslint, file) {
  const config = await eslint.calculateConfigForFile(file);
  return normalizeRules(
    Object.fromEntries(
      Object.entries(config.rules)
        // Turned-off rules may have no oxlint equivalent, and may share one with an enabled rule.
        .filter(([, entry]) => (Array.isArray(entry) ? entry[0] : entry) !== 0)
        .map(([rule, entry]) => {
          const { key } = routeRule(rule);
          // The oxlint configs drop options oxlint rejects that only repeat the defaults.
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

/**
 * What ESLint reports, as `file:line rule`, with rules under their oxlint names.
 * @param {import('eslint').ESLint} eslint
 * @param {string} cwd
 * @param {string[]} files
 * @returns {Promise<Set<string>>}
 */
export async function eslintFindings(eslint, cwd, files) {
  const findings = new Set();
  for (const result of await eslint.lintFiles(files)) {
    for (const message of result.messages) {
      const rule = message.ruleId ? routeRule(message.ruleId).key : 'unused-directive';
      findings.add(finding(path.relative(cwd, result.filePath), message.line, rule));
    }
  }
  return findings;
}

/**
 * What oxlint reports with a config file, as `file:line rule`, with rules under their config
 * names.
 * @param {string} configPath
 * @param {string} cwd
 * @param {string[]} files
 * @returns {Set<string>}
 */
export function oxlintFindings(configPath, cwd, files) {
  const { stdout } = spawnSync(
    process.execPath,
    [oxlintBin, '-c', configPath, '-f', 'unix', '--report-unused-disable-directives', ...files],
    { cwd, encoding: 'utf8' },
  );
  const findings = new Set();
  for (const line of stdout.split('\n')) {
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
    findings.add(finding(file, Number(lineNumber), key));
  }
  return findings;
}
