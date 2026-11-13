import { EXTENSION_DTS } from '../extensions.mjs';

/**
 * typescript-eslint rules, and the core rules they replace. Replaces the Airbnb TypeScript config.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      minimumDescriptionLength: 10,
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
    },
  ],
  '@typescript-eslint/default-param-last': 'error',
  // The `@typescript-eslint/naming-convention` rule allows `leadingUnderscore` and `trailingUnderscore` settings. However, the existing `no-underscore-dangle` rule already takes care of this.
  '@typescript-eslint/naming-convention': [
    'error',
    // Allow __dirname and __filename
    {
      filter: {
        match: true,
        regex: '^__(dirname|filename)$',
      },
      format: null,
      selector: 'variable',
    },
    // Allow camelCase variables (23.2), PascalCase variables (23.8), and UPPER_CASE variables (23.10)
    {
      format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      selector: 'variable',
    },
    // Allow camelCase functions (23.2), and PascalCase functions (23.8)
    {
      format: ['camelCase', 'PascalCase'],
      selector: 'function',
    },
    // Airbnb recommends PascalCase for classes (23.3), and although Airbnb does not make TypeScript recommendations, we are assuming this rule would similarly apply to anything "type like", including interfaces, type aliases, and enums
    {
      format: ['PascalCase'],
      selector: 'typeLike',
    },
  ],
  '@typescript-eslint/no-array-constructor': 'error',
  // disallow empty functions, except for standalone funcs/arrows
  // https://eslint.org/docs/rules/no-empty-function
  '@typescript-eslint/no-empty-function': [
    'error',
    {
      allow: ['arrowFunctions', 'functions', 'methods'],
    },
  ],
  '@typescript-eslint/no-loop-func': 'error',
  // Namespace rule
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/no-redeclare': 'off',
  '@typescript-eslint/no-shadow': 'error',
  '@typescript-eslint/no-this-alias': 'off',
  '@typescript-eslint/no-unused-expressions': [
    'error',
    { allowShortCircuit: false, allowTernary: false },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
      caughtErrorsIgnorePattern: '^(_|ignore)',
      destructuredArrayIgnorePattern: '^_',
      ignoreRestSiblings: true,
      vars: 'all',
      varsIgnorePattern: '^(_|React$)',
    },
  ],
  '@typescript-eslint/no-use-before-define': [
    'error',
    {
      classes: true,
      functions: false,
      variables: true,
    },
  ],
  '@typescript-eslint/no-useless-constructor': 'error',
  '@typescript-eslint/return-await': 'off',
  '@typescript-eslint/triple-slash-reference': 'off',
  // TypeScript naming convention (replaces camelcase)
  camelcase: 'off',
  // TypeScript equivalents of ESLint rules
  'default-param-last': 'off',
  'no-array-constructor': 'off',
  'no-empty-function': 'off',
  'no-loop-func': 'off',
  'no-redeclare': 'off',
  'no-shadow': 'off',
  'no-unused-expressions': 'off',
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'no-useless-constructor': 'off',
  'piplup/add-undef-to-optional': 'off',
  'require-await': 'off',
};

/**
 * Separate `import type` statements. The base config's `consistentTypeImports` option, on by
 * default, turns these on.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const consistentTypeImportsRules = {
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      fixStyle: 'separate-type-imports',
    },
  ],
  'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
};

/**
 * Declaration files describe types only, so `import type` adds nothing there.
 * @type {import('eslint').Linter.Config}
 */
export const dtsConfig = {
  files: [`**/*${EXTENSION_DTS}`],
  name: 'piplup-core-config/dts',
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
  },
};
