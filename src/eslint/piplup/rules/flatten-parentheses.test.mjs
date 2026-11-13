import TSESlintParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

import rule from './flatten-parentheses.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: TSESlintParser,
  },
});

ruleTester.run('flatten-parentheses', rule, {
  invalid: [
    // Basic union flattening - example from the problem statement
    {
      code: `type T = (1 | 2 | 3) | 4;`,
      errors: [
        {
          column: 11,
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = 1 | 2 | 3 | 4;`,
    },

    // Union on the right side
    {
      code: `type T = 1 | (2 | 3 | 4);`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = 1 | 2 | 3 | 4;`,
    },

    // Multiple parenthesized unions
    {
      code: `type T = (1 | 2) | (3 | 4);`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = 1 | 2 | 3 | 4;`,
    },

    // Intersection flattening
    {
      code: `type T = (A & B & C) & D;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A & B & C & D;`,
    },

    // Intersection on the right
    {
      code: `type T = A & (B & C & D);`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A & B & C & D;`,
    },

    // Multiple parenthesized intersections
    {
      code: `type T = (A & B) & (C & D);`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A & B & C & D;`,
    },

    // With type aliases
    {
      code: `type Union = (string | number) | boolean;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type Union = string | number | boolean;`,
    },

    // In type parameters
    {
      code: `type T<U> = (U | null) | undefined;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T<U> = U | null | undefined;`,
    },

    // With whitespace (trailing space left for Prettier to clean up)
    {
      code: `type T = ( A | B ) | C;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A | B  | C;`,
    },

    // Nested unions - multiple fix passes needed due to overlapping ranges
    {
      code: `type T = ((A | B) | C) | D;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: [`type T = (A | B) | C | D;`, `type T = A | B | C | D;`],
    },

    // Complex type names
    {
      code: `type Result = (Success<Data> | Error<Message>) | Loading;`,
      errors: [
        {
          line: 1,
          messageId: 'flattenParentheses',
        },
      ],
      output: `type Result = Success<Data> | Error<Message> | Loading;`,
    },

    // Multiline union (Prettier cleans up extra whitespace)
    {
      code: `type T = (\n  A | B\n) | C;`,
      errors: [
        {
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A | B\n | C;`,
    },

    // Leading block comment inside parentheses - preserved in output
    {
      code: `type T = (/* comment */ A | B) | C;`,
      errors: [
        {
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = /* comment */ A | B | C;`,
    },

    // Trailing block comment inside parentheses - preserved in output
    {
      code: `type T = (A | B /* comment */) | C;`,
      errors: [
        {
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A | B /* comment */ | C;`,
    },

    // Trailing line comment - newline preserved so | C continues on next line
    {
      code: `type T = (A | B // comment\n) | C;`,
      errors: [
        {
          messageId: 'flattenParentheses',
        },
      ],
      output: `type T = A | B // comment\n | C;`,
    },

    // Multiline union with leading pipes inside parentheses
    {
      code: 'type T =\n  | (\n      | boolean\n      | string\n    )\n  | undefined;',
      errors: [
        {
          messageId: 'flattenParentheses',
        },
      ],
      output: 'type T =\n  | boolean\n      | string\n    \n  | undefined;',
    },
  ],
  valid: [
    // Simple union without parentheses
    `type T = 1 | 2 | 3;`,

    // Simple intersection without parentheses
    `type T = A & B & C;`,

    // Parentheses around single type (not in union/intersection context)
    `type T = (string);`,

    // Parentheses needed for precedence (intersection inside union)
    `type T = (A & B) | C;`,

    // Parentheses needed for precedence (union inside intersection)
    `type T = (A | B) & C;`,

    // Complex nested structure where parentheses change meaning
    `type T = (A | B) & (C | D);`,

    // Function types where parentheses are needed
    `type T = (() => void) | string;`,

    // Array types
    `type T = (string | number)[];`,

    // Generic types
    `type T = Promise<string | number>;`,

    // Mixed operators - parentheses are needed
    `type T = A | (B & C);`,
    `type T = (A | B) & (C | D) | E;`,
  ],
});
