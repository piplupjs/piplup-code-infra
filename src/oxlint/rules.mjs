import { DROP_OPTIONS, routeRule } from './create-config.mjs';

/**
 * Renames ESLint rules to the names the presets and `createOxlintConfig` give them in oxlint, so a
 * project can change them by the names it knows:
 *
 * ```ts
 * rules: rules({ 'react/prop-types': 'off', 'import/order': 'off' })
 * ```
 *
 * A rule oxlint implements gets oxlint's name, like `typescript/no-explicit-any`. A rule oxlint
 * runs from the ESLint plugin gets the plugin's name in oxlint, like `react-js/prop-types`. Options
 * stay as they are, except that a few oxlint rules reject options that only repeat the defaults.
 * @param {Record<string, import('eslint').Linter.RuleEntry>} eslintRules - Rules by ESLint name.
 * @returns {Record<string, import('eslint').Linter.RuleEntry>} The same rules by oxlint name.
 */
export function rules(eslintRules) {
  return Object.fromEntries(
    Object.entries(eslintRules).map(([rule, entry]) => {
      const { key } = routeRule(rule);
      return [key, DROP_OPTIONS.has(key) && Array.isArray(entry) ? entry[0] : entry];
    }),
  );
}
