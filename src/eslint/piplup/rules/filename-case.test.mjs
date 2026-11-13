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
  invalid: [
    {
      code,
      errors: [
        {
          data: { name: 'baseConfig.mjs', suggestion: 'base-config.mjs' },
          messageId: 'notKebabCase',
        },
      ],
      filename: 'src/baseConfig.mjs',
    },
    {
      code,
      errors: [
        { data: { name: 'Button.tsx', suggestion: 'button.tsx' }, messageId: 'notKebabCase' },
      ],
      filename: 'src/Button.tsx',
    },
    {
      code,
      errors: [
        {
          data: { name: 'cmdPublish.test.mjs', suggestion: 'cmd-publish.test.mjs' },
          messageId: 'notKebabCase',
        },
      ],
      filename: 'src/cmdPublish.test.mjs',
    },
    {
      code,
      errors: [
        { data: { name: 'snake_case.ts', suggestion: 'snake-case.ts' }, messageId: 'notKebabCase' },
      ],
      filename: 'src/snake_case.ts',
    },
    {
      code,
      errors: [
        {
          data: { name: 'parseHTMLString.ts', suggestion: 'parse-html-string.ts' },
          messageId: 'notKebabCase',
        },
      ],
      filename: 'src/parseHTMLString.ts',
    },
  ],
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
});
