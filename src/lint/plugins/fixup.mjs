import { fixupPluginRules } from '@eslint/compat';

/** @type {WeakMap<object, import('eslint').ESLint.Plugin>} */
const fixedPlugins = new WeakMap();

/**
 * Whether a rule runs on JavaScript (or MDX, which eslint-mdx parses to ESTree). JSON and
 * Markdown have their own ASTs, and `fixupPluginRules` can't create a JavaScript rule for them.
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {boolean}
 */
function isJavaScript(context) {
  const ast = /** @type {{ type?: string } | undefined} */ (context.sourceCode?.ast);
  return ast?.type === undefined || ast.type === 'Program';
}

/**
 * Makes a JavaScript rule do nothing in files of other languages, so a rule turned on for every
 * file, or a config that also covers JSON, doesn't crash ESLint there.
 * @param {import('eslint').Rule.RuleModule} rule
 * @returns {import('eslint').Rule.RuleModule}
 */
function onlyJavaScript(rule) {
  return {
    ...rule,
    create(context) {
      return isJavaScript(context) ? rule.create(context) : {};
    },
  };
}

/**
 * Wraps a third-party plugin so it runs under ESLint 10 and oxlint, which no longer provide the
 * deprecated context methods (`context.getFilename()` and friends) some plugins still call. Its
 * rules do nothing outside JavaScript. Cached by plugin, so every caller gets the same wrapped
 * object, and wrapping a wrapped plugin returns it unchanged.
 * @param {unknown} plugin
 * @returns {import('eslint').ESLint.Plugin}
 */
export function fixupPlugin(plugin) {
  const key = /** @type {object} */ (plugin);
  const cached = fixedPlugins.get(key);
  if (cached) {
    return cached;
  }
  const compat = /** @type {import('eslint').ESLint.Plugin} */ (
    fixupPluginRules(/** @type {any} */ (plugin))
  );
  /** @type {import('eslint').ESLint.Plugin} */
  const fixed = {
    ...compat,
    rules: Object.fromEntries(
      Object.entries(compat.rules ?? {}).map(([name, rule]) => [
        name,
        onlyJavaScript(/** @type {import('eslint').Rule.RuleModule} */ (rule)),
      ]),
    ),
  };
  fixedPlugins.set(key, fixed);
  fixedPlugins.set(fixed, fixed);
  return fixed;
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
