/**
 * @typedef {Partial<import('./create-config.mjs').OxlintConfig> & Record<string, unknown>} Config
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges objects key by key, with later values winning. Nested objects merge too; arrays don't.
 * A `__proto__` key, which `JSON.parse` can give an object, is skipped: assigning it would replace
 * the merged object's prototype.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} next
 * @returns {Record<string, unknown>}
 */
function deepMerge(base, next) {
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(next)) {
    if (key === '__proto__') {
      continue;
    }
    const current = Object.hasOwn(out, key) ? out[key] : undefined;
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out;
}

/**
 * Combines the presets with a project's own config into one oxlint config. Use it instead of
 * `extends`, which drops the `settings` and `options` of the configs it extends, such as the React
 * version and type-aware linting:
 *
 * ```ts
 * export default combine(presets.recommended, presets.test, { rules: rules({ ... }) });
 * ```
 *
 * Later configs win, as in an ESLint flat config: their rules, globals, settings and options
 * replace earlier ones, and nested settings merge. Overrides apply in order. A later top-level
 * rule also wins over an earlier config's override for some files, such as the test files, so
 * turning a rule off turns it off everywhere. Plugins, `jsPlugins` and `ignorePatterns` add up.
 * @param {...Config} configs
 * @returns {Config}
 */
export function combine(...configs) {
  /** @type {Config} */
  let combined = {};
  for (const config of configs) {
    const { globals, ignorePatterns, jsPlugins, overrides, plugins, rules, ...rest } = config;
    combined = deepMerge(combined, rest);

    if (rules) {
      // oxlint applies overrides after the top-level rules, so an earlier override for some files
      // would win over these rules. An override for every file, before this config's own, wins
      // over it.
      const earlierOverrides = combined.overrides ?? [];
      const overridden = Object.fromEntries(
        Object.entries(rules).filter(([rule]) =>
          earlierOverrides.some(
            (override) => override.rules && Object.hasOwn(override.rules, rule),
          ),
        ),
      );
      combined.rules = { ...combined.rules, ...rules };
      if (Object.keys(overridden).length > 0) {
        combined.overrides = [
          ...(combined.overrides ?? []),
          { files: ['**/*'], rules: overridden },
        ];
      }
    }
    if (globals) {
      combined.globals = { ...combined.globals, ...globals };
    }
    if (overrides) {
      combined.overrides = [...(combined.overrides ?? []), ...overrides];
    }
    if (plugins) {
      combined.plugins = [...new Set([...(combined.plugins ?? []), ...plugins])];
    }
    if (jsPlugins) {
      const names = new Set((combined.jsPlugins ?? []).map(({ name }) => name));
      combined.jsPlugins = [
        ...(combined.jsPlugins ?? []),
        ...jsPlugins.filter(({ name }) => !names.has(name)),
      ];
    }
    if (ignorePatterns) {
      combined.ignorePatterns = [
        ...new Set([...(combined.ignorePatterns ?? []), ...ignorePatterns]),
      ];
    }
  }
  return combined;
}
