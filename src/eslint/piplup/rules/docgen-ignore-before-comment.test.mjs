import parser from '@typescript-eslint/parser';
import eslint from 'eslint';

import rule from './docgen-ignore-before-comment.mjs';

const ruleTester = new eslint.RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run('ignore-before-comment', rule, {
  invalid: [
    {
      code: '\n/**\n * Comment.\n * @ignore\n */\n',
      errors: [
        {
          message: '@ignore should be at the beginning of a block comment.',
        },
      ],
    },
    {
      code: '\n  /**\n   * Multi-line\n   * comment.\n   * @ignore\n   */\n',
      errors: [
        {
          message: '@ignore should be at the beginning of a block comment.',
        },
      ],
    },
    {
      code: '\n  /**\n   * Multi-line\n   * @ignore\n   * comment.\n   */\n',
      errors: [
        {
          message: '@ignore should be at the beginning of a block comment.',
        },
      ],
    },
    {
      code: '\n  /**\n   * Indented\n   * multi-line\n   * comment.\n   * @ignore\n   */\n',
      errors: [
        {
          message: '@ignore should be at the beginning of a block comment.',
        },
      ],
    },
    {
      code: '\r\n/**\r\n * Comment.\r\n * @ignore\r\n */\r\n',
      errors: [
        {
          message: '@ignore should be at the beginning of a block comment.',
        },
      ],
    },
  ],
  valid: [
    // A long comment of `*` lines, which a backtracking regular expression took minutes on.
    `/*${'*\n'.repeat(200_000)}*/`,
    // The line before the comment lines must end in `*`.
    '\n/*x\n *\n * @ignore\n */\n',
    // `@ignore` must be the whole line.
    '\n/**\n * Comment.\n * @ignore this\n */\n',
    '\n/**\n * @ignore\n */\n',
    '\n/**\n * @ignore\n * Comment.\n */\n',
    '\n/**\n * @ignore\n * Multi-line\n * comment.\n */\n',
    '\n  /**\n   * @ignore\n   * Indented\n   * multi-line\n   * comment.\n   */\n',
  ],
});
