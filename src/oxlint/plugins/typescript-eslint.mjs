import { plugin } from 'typescript-eslint';

import { withEslintDirectives } from './with-eslint-directives.mjs';

/**
 * typescript-eslint rules that can run without type information still ask for the parser
 * services, which only `@typescript-eslint/parser` provides. Hand them an empty set, the same
 * thing that parser provides when no TypeScript project is configured.
 */
const parserServices = {
  program: null,
  esTreeNodeToTSNodeMap: new WeakMap(),
  tsNodeToESTreeNodeMap: new WeakMap(),
};

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {import('eslint').Rule.RuleContext}
 */
function withParserServices(context) {
  const sourceCode = Object.create(context.sourceCode, {
    parserServices: { value: parserServices },
  });
  return Object.create(context, {
    sourceCode: { value: sourceCode },
    parserServices: { value: parserServices },
  });
}

/**
 * typescript-eslint, for the rules oxlint's `typescript` plugin doesn't cover. oxlint runs it as
 * `typescript-js`.
 */
export default withEslintDirectives(
  {
    ...plugin,
    rules: Object.fromEntries(
      Object.entries(/** @type {Record<string, any>} */ (/** @type {any} */ (plugin).rules)).map(
        ([name, rule]) => [
          name,
          {
            ...rule,
            /** @param {import('eslint').Rule.RuleContext} context */
            create: (context) => rule.create(withParserServices(context)),
          },
        ],
      ),
    ),
  },
  '@typescript-eslint',
);
