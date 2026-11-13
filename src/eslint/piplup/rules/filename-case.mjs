import * as path from 'node:path';

const KEBAB_SEGMENT = /^_*[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {string} segment
 * @returns {string}
 */
function toKebabCase(segment) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Requires file names to be kebab-case. Every dot-separated part of the name is checked, so
 * `base-config.mjs`, `cmd-publish.test.mjs` and `package-json.d.ts` pass while `baseConfig.mjs`
 * does not. Leading underscores (`_app.tsx`) and a leading dot (`.remarkrc.mjs`) are allowed.
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require kebab-case file names.',
    },
    messages: {
      notKebabCase: 'File name "{{name}}" is not kebab-case. Rename it to "{{suggestion}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regular expressions for file names (not paths) to skip.',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const name = path.basename(context.physicalFilename ?? context.filename);
    // Code passed on stdin or to the RuleTester without a file name has no name to check.
    if (name === '<input>' || name === '<text>') {
      return {};
    }
    const ignore = (context.options[0]?.ignore ?? []).map(
      (/** @type {string} */ pattern) => new RegExp(pattern),
    );
    if (ignore.some((/** @type {RegExp} */ pattern) => pattern.test(name))) {
      return {};
    }

    const segments = name.split('.');
    const offending = segments.some((segment, index) => {
      // The empty part before a leading dot, as in `.remarkrc.mjs`.
      if (index === 0 && segment === '') {
        return false;
      }
      return !KEBAB_SEGMENT.test(segment);
    });
    if (!offending) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: 'notKebabCase',
          data: {
            name,
            suggestion: segments.map((segment) => toKebabCase(segment)).join('.'),
          },
        });
      },
    };
  },
};

export default rule;
