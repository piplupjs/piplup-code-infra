import { defineConfig } from 'eslint/config';
import * as tseslint from 'typescript-eslint';

import { configs as testingLibraryConfigs } from '../lint/plugins/testing-library.mjs';
import { configs as vitestConfigs } from '../lint/plugins/vitest.mjs';

import { EXTENSION_TS } from './extensions.mjs';

/**
 * @type {import('eslint').Linter.Config}
 */
export const baseSpecRules = {
  files: [`**/*.spec${EXTENSION_TS}`],
  name: 'Spec files rules',
  rules: {
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'compat/compat': 'off',
    'import/prefer-default-export': 'off',
    'jsx-a11y/anchor-has-content': 'off',

    'jsx-a11y/anchor-is-valid': 'off',
    'jsx-a11y/tabindex-no-positive': 'off',
    'no-alert': 'off',

    'no-console': 'off',

    'no-empty-pattern': 'off',
    'no-lone-blocks': 'off',
    'no-shadow': 'off',

    'react/default-props-match-prop-types': 'off',
    'react/function-component-definition': 'off',
    'react/no-access-state-in-setstate': 'off',
    'react/no-unused-prop-types': 'off',
    'react/prefer-stateless-function': 'off',
    'react/prop-types': 'off',
    'react/require-default-props': 'off',
    'react/state-in-constructor': 'off',
    'react/static-property-placement': 'off',
  },
};

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export function createTestConfig() {
  return defineConfig(
    vitestConfigs.recommended,
    testingLibraryConfigs.dom,
    testingLibraryConfigs.react,
    {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: 7,
        },
      },
      name: 'Test files',
      rules: {
        // Part of the migration away from airbnb config. Turned of initially.
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
        'compat/compat': 'off',
        // does not work with wildcard imports. Mistakes will throw at runtime anyway
        'import/named': 'off',

        'jsx-a11y/anchor-is-valid': 'off',
        // disable eslint-plugin-jsx-a11y
        // tests are not driven by assistive technology
        // add `jsx-a11y` rules once you encounter them in tests
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/control-has-associated-label': 'off',
        'jsx-a11y/iframe-has-title': 'off',
        'jsx-a11y/label-has-associated-control': 'off',
        'jsx-a11y/mouse-events-have-key-events': 'off',
        'jsx-a11y/no-noninteractive-tabindex': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        'jsx-a11y/tabindex-no-positive': 'off',

        'piplup/consistent-production-guard': 'off',
        'piplup/disallow-active-element-as-key-event-target': 'error',
        // In tests this is generally intended.
        'react/button-has-type': 'off',
        // They are accessed to test custom validator implementation with PropTypes.checkPropTypes
        'react/forbid-foreign-prop-types': 'off',
        'react/no-unused-prop-types': 'off',
        // components that are defined in test are isolated enough
        // that they don't need type-checking
        'react/prop-types': 'off',
        'testing-library/no-node-access': 'off',
        // end migration
        'vitest/prefer-importing-vitest-globals': 'error',
        // Vitest accepts a failure message as the second argument of `expect`, also when it is
        // not a literal.
        'vitest/valid-expect': ['error', { maxArgs: 2 }],
      },
    },
  );
}
