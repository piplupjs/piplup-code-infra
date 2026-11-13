/**
 * Writes the list of rules built into the installed oxlint to src/oxlint/builtin-rules.json.
 * createOxlintConfig uses it to decide which of our ESLint rules oxlint runs natively.
 * Run it after upgrading oxlint: `pnpm oxlint:update-rules`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

const require = createRequire(import.meta.url);
const oxlintPackageJsonPath = require.resolve('oxlint/package.json');
const { version } = JSON.parse(fs.readFileSync(oxlintPackageJsonPath, 'utf8'));
const bin = path.join(path.dirname(oxlintPackageJsonPath), 'bin', 'oxlint');

/** @type {{ scope: string, value: string, type_aware: boolean }[]} */
const rules = JSON.parse(
  execFileSync(process.execPath, [bin, '--rules', '-f', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
);

/** @type {Record<string, string[]>} */
const byScope = {};
for (const rule of rules) {
  (byScope[rule.scope] ??= []).push(rule.value);
}
for (const names of Object.values(byScope)) {
  names.sort();
}

const output = {
  rules: Object.fromEntries(Object.entries(byScope).sort(([a], [b]) => a.localeCompare(b))),
  typeAware: rules
    .filter((rule) => rule.type_aware)
    .map((rule) => `${rule.scope}/${rule.value}`)
    .sort(),
  version,
};

const outputPath = new URL('../src/oxlint/builtin-rules.json', import.meta.url);
fs.mkdirSync(new URL('.', outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${rules.length} oxlint ${version} rules.`);
