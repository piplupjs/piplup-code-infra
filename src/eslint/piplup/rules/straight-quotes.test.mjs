import parser from '@typescript-eslint/parser';
import eslint from 'eslint';

import rule from './straight-quotes.mjs';

const ruleTester = new eslint.RuleTester({
  languageOptions: {
    parser,
  },
});

ruleTester.run('straight-quotes', rule, {
  valid: [
    `
const values = [
  {
    title: 'Put community first 💙',
  },
];
  `,
  ],
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
          messageId: 'wrongQuotes',
          line: 5,
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
          line: 2,
          column: 32,
          messageId: 'wrongQuotes',
        },
        {
          line: 2,
          column: 36,
          messageId: 'wrongQuotes',
        },
        {
          line: 2,
          column: 41,
          messageId: 'wrongQuotes',
        },
        {
          line: 2,
          column: 46,
          messageId: 'wrongQuotes',
        },
      ],
    },
  ],
});
