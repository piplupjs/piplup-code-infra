import parser from '@typescript-eslint/parser';
import eslint from 'eslint';

import rule from './straight-quotes.mjs';

const ruleTester = new eslint.RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run('straight-quotes', rule, {
  invalid: [
    {
      code: `
const values = [
  {
    title: 'Put community first 💙',
    description: 'We never lose sight of who we’re serving and why.',
  },
];
      `,
      errors: [
        {
          line: 5,
          messageId: 'wrongQuotes',
        },
      ],
    },
    {
      code: `
// reference ID (also known as “SHA” or “hash”) of the commit we're building.
const values = 'foo';
      `,
      errors: [
        {
          column: 32,
          line: 2,
          messageId: 'wrongQuotes',
        },
        {
          column: 36,
          line: 2,
          messageId: 'wrongQuotes',
        },
        {
          column: 41,
          line: 2,
          messageId: 'wrongQuotes',
        },
        {
          column: 46,
          line: 2,
          messageId: 'wrongQuotes',
        },
      ],
    },
  ],
  valid: [
    `
const values = [
  {
    title: 'Put community first 💙',
  },
];
  `,
  ],
});
