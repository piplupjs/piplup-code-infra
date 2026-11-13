import parser from '@typescript-eslint/parser';
import eslint from 'eslint';

import rule from './filename-case.mjs';

const ruleTester = new eslint.RuleTester({
  languageOptions: {
    parser,
  },
});

const code = 'export const value = 1;';

ruleTester.run('filename-case', rule, {
  valid: [
    { code, filename: 'src/base-config.mjs' },
    { code, filename: 'src/cmd-publish.test.mjs' },
    { code, filename: 'src/package-json.d.ts' },
    { code, filename: 'src/index.tsx' },
    { code, filename: 'vite.config.mts' },
    { code, filename: '.remarkrc.mjs' },
    { code, filename: 'pages/_app.tsx' },
    { code, filename: 'v2-utils.ts' },
    // A camelCase directory is not this rule's concern.
    { code, filename: 'someDir/file-name.ts' },
    { code, filename: 'src/Button.tsx', options: [{ ignore: ['^[A-Z][A-Za-z]*\\.tsx$'] }] },
  ],
  invalid: [
    {
      code,
      filename: 'src/baseConfig.mjs',
      errors: [
        {
          messageId: 'notKebabCase',
          data: { name: 'baseConfig.mjs', suggestion: 'base-config.mjs' },
        },
      ],
    },
    {
      code,
      filename: 'src/Button.tsx',
      errors: [
        { messageId: 'notKebabCase', data: { name: 'Button.tsx', suggestion: 'button.tsx' } },
      ],
    },
    {
      code,
      filename: 'src/cmdPublish.test.mjs',
      errors: [
        {
          messageId: 'notKebabCase',
          data: { name: 'cmdPublish.test.mjs', suggestion: 'cmd-publish.test.mjs' },
        },
      ],
    },
    {
      code,
      filename: 'src/snake_case.ts',
      errors: [
        { messageId: 'notKebabCase', data: { name: 'snake_case.ts', suggestion: 'snake-case.ts' } },
      ],
    },
    {
      code,
      filename: 'src/parseHTMLString.ts',
      errors: [
        {
          messageId: 'notKebabCase',
          data: { name: 'parseHTMLString.ts', suggestion: 'parse-html-string.ts' },
        },
      ],
    },
  ],
});
