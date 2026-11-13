import { findDisablingDirective, parseDirectives } from '../directives.mjs';

/**
 * @param {any} descriptor - What the rule passed to `context.report`.
 * @returns {import('../directives.mjs').Position | undefined}
 */
function positionOf(descriptor) {
  const loc = descriptor.loc ?? descriptor.node?.loc;
  if (!loc) {
    return undefined;
  }
  return 'start' in loc ? loc.start : loc;
}

/**
 * oxlint reserves the names of its built-in plugins, so an ESLint plugin it loads to fill a gap
 * runs under another name, e.g. `react-js`. oxlint then matches `eslint-disable` comments that
 * name `react/...` against its built-in plugin only. This makes the plugin's rules honor
 * comments that use the ESLint names, so existing comments keep working.
 *
 * oxlint still counts such a comment as unused, because none of its own diagnostics matched it.
 * @template {{ rules?: Record<string, any> }} T
 * @param {T} plugin
 * @param {string} eslintPrefix - The rule prefix in ESLint, e.g. `react`. Empty for core rules.
 * @returns {T}
 */
export function withEslintDirectives(plugin, eslintPrefix) {
  return {
    ...plugin,
    rules: Object.fromEntries(
      Object.entries(plugin.rules ?? {}).map(([name, rule]) => {
        const eslintName = eslintPrefix ? `${eslintPrefix}/${name}` : name;
        /** @param {import('eslint').Rule.RuleContext} context */
        const create = (context) => {
          /** @type {import('../directives.mjs').Directive[] | undefined} */
          let directives;
          /** @param {any} descriptor */
          const report = (descriptor) => {
            directives ??= parseDirectives(
              /** @type {any[]} */ (context.sourceCode.getAllComments()),
            );
            const position = positionOf(descriptor);
            const disabled =
              position &&
              findDisablingDirective(directives, (ruleName) => ruleName === eslintName, position);
            if (!disabled) {
              context.report(descriptor);
            }
          };
          return rule.create(Object.create(context, { report: { value: report } }));
        };
        return [name, { ...rule, create }];
      }),
    ),
  };
}
