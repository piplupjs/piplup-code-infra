import { defineConfig } from 'eslint/config';

import { configs as reactHooksConfigs } from '../../lint/plugins/react-hooks.mjs';
import { configs as reactConfigs } from '../../lint/plugins/react.mjs';
import { EXTENSION_TS } from '../extensions.mjs';

import { languageOptions } from './shared.mjs';

/**
 * eslint-plugin-react and eslint-plugin-react-hooks rules on top of their recommended configs.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  'react-hooks/exhaustive-deps': [
    'error',
    { additionalHooks: '(useEnhancedEffect|useIsoLayoutEffect|useIsomorphicEffect)' },
  ],
  'react-hooks/rules-of-hooks': 'error',
  // Prevent usage of button elements without an explicit type attribute
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/button-has-type.md
  'react/button-has-type': [
    'error',
    {
      button: true,
      reset: false,
      submit: true,
    },
  ],
  'react/default-props-match-prop-types': [
    'error',
    {
      // Otherwise the rule thinks inner props = outer props
      // But in TypeScript we want to know that a certain prop is defined during render
      // while it can be ommitted from the callsite.
      // Then defaultProps (or default values) will make sure that the prop is defined during render
      allowRequiredDefaults: true,
    },
  ],
  // Can add verbosity to small functions making them harder to grok.
  // Though we have to manually enforce it for function components with default values.
  'react/destructuring-assignment': 'off',
  // Prevent missing displayName in a React component definition
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/display-name.md
  'react/display-name': ['off', { ignoreTranspilerName: false }],
  // Forbids using non-exported propTypes
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/forbid-foreign-prop-types.md
  // this is intentionally set to "warn". it would be "error",
  // but it's only critical if you're stripping propTypes in production.
  'react/forbid-foreign-prop-types': ['warn', { allowInPropTypes: true }],
  'react/forbid-prop-types': 'off', // Too strict, no time for that
  // Enforce a specific function type for function components
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/function-component-definition.md
  'react/function-component-definition': [
    'error',
    {
      namedComponents: ['function-declaration', 'function-expression'],
      unnamedComponents: 'function-expression',
    },
  ],
  'react/jsx-curly-brace-presence': 'off', // broken
  // airbnb is using .jsx
  'react/jsx-filename-extension': ['error', { extensions: ['.js', '.tsx'] }],
  // Prefer <React.Fragment> over <>.
  'react/jsx-fragments': ['error', 'element'],
  // Validate JSX has key prop when in array or iterator
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-key.md
  // Turned off because it has too many false positives
  'react/jsx-key': 'off',
  // Enforces premature optimization
  'react/jsx-no-bind': 'off',
  // Prevent react contexts from taking non-stable values
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/e2eaadae316f9506d163812a09424eb42698470a/docs/rules/jsx-no-constructed-context-values.md
  'react/jsx-no-constructed-context-values': 'error',
  // noopener is enough
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-target-blank.md#rule-options
  'react/jsx-no-target-blank': ['error', { allowReferrer: true }],
  'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
  'react/jsx-props-no-spreading': 'off',
  // This rule is great for raising people awareness of what a key is and how it works.
  'react/no-array-index-key': 'off',
  'react/no-danger': 'error',
  'react/no-direct-mutation-state': 'error',
  // Avoid accidental auto-"fixes" https://github.com/jsx-eslint/eslint-plugin-react/issues/3458
  'react/no-invalid-html-attribute': 'off',
  'react/no-unknown-property': ['error', { ignore: ['sx'] }],
  // Prevent unused propType definitions
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unused-prop-types.md
  'react/no-unused-prop-types': [
    'error',
    {
      customValidators: [],
      skipShapeProps: true,
    },
  ],
  // Require stateless functions when not using lifecycle methods, setState or ref
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/prefer-stateless-function.md
  'react/prefer-stateless-function': ['error', { ignorePureComponents: true }],
  // Not always relevant
  'react/require-default-props': 'off',
  'react/sort-prop-types': 'error',
  // This depends entirely on what you're doing. There's no universal pattern
  'react/state-in-constructor': 'off',
  // stylistic opinion. For conditional assignment we want it outside, otherwise as static
  'react/static-property-placement': 'off',
};

/**
 * React: eslint-plugin-react's and eslint-plugin-react-hooks' recommended rules, and ours.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig({
  extends: [reactConfigs.recommended, reactHooksConfigs.recommended],
  files: [`**/*${EXTENSION_TS}`],
  languageOptions,
  name: 'piplup/react',
  rules,
});
