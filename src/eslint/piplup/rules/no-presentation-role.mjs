/**
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  create(context) {
    return {
      /** @param {import('estree-jsx').JSXAttribute} node */
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'role') {
          return;
        }

        const { value } = node;

        // role="presentation"
        if (value !== null && value.type === 'Literal' && value.value === 'presentation') {
          context.report({
            fix(fixer) {
              return fixer.replaceText(value, '"none"');
            },
            messageId: 'noPresentation',
            node,
          });
          return;
        }

        // role={'presentation'}
        if (
          value !== null &&
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'Literal' &&
          value.expression.value === 'presentation'
        ) {
          context.report({
            fix(fixer) {
              return fixer.replaceText(value, '"none"');
            },
            messageId: 'noPresentation',
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        'Disallow role="presentation" in favor of role="none". Both are equivalent, but role="none" is clearer and shorter.',
    },
    fixable: 'code',
    messages: {
      noPresentation:
        'Use role="none" instead of role="presentation". They are equivalent, but role="none" is preferred.',
    },
    schema: [],
    type: 'suggestion',
  },
};

export default rule;
