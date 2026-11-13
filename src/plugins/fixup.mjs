import { fixupPluginRules } from '@eslint/compat';

/**
 * Wraps a third-party plugin so it runs under ESLint 10 and oxlint, which no longer provide the
 * deprecated context methods (`context.getFilename()` and friends) some plugins still call.
 * `fixupPluginRules` caches by plugin, so every caller gets the same wrapped object.
 * @param {unknown} plugin
 * @returns {import('eslint').ESLint.Plugin}
 */
export function fixupPlugin(plugin) {
  return /** @type {import('eslint').ESLint.Plugin} */ (
    fixupPluginRules(/** @type {any} */ (plugin))
  );
}

/**
 * Points a plugin's shareable configs at the wrapped plugins from `fixupPlugin`. ESLint configs
 * and oxlint then use the same plugin object.
 * @param {unknown} configs - A config or an array of configs.
 * @returns {import('eslint').Linter.Config[]}
 */
export function fixupConfigs(configs) {
  /** @param {any} config */
  const fixup = (config) =>
    config.plugins
      ? {
          ...config,
          plugins: Object.fromEntries(
            Object.entries(config.plugins).map(([name, plugin]) => [name, fixupPlugin(plugin)]),
          ),
        }
      : config;
  return Array.isArray(configs) ? configs.map(fixup) : [fixup(configs)];
}
