import { defineConfig } from 'eslint/config';

import { configs as jsxA11yConfigs } from '../../lint/plugins/jsx-a11y.mjs';
import { EXTENSION_TS } from '../extensions.mjs';
import piplupPlugin from '../piplup/index.mjs';

import { languageOptions } from './shared.mjs';

/**
 * eslint-plugin-jsx-a11y rules on top of its recommended config.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  // Enforce that all elements that require alternative text have meaningful information
  // https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/alt-text.md
  'jsx-a11y/alt-text': [
    'error',
    {
      elements: ['img'],
    },
  ],
  // ensure <a> tags are valid
  // https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/0745af376cdc8686d85a361ce36952b1fb1ccf6e/docs/rules/anchor-is-valid.md
  'jsx-a11y/anchor-is-valid': [
    'error',
    {
      aspects: ['noHref', 'invalidHref', 'preferButton'],
      components: ['Link'],
      specialLink: ['to'],
    },
  ],
  // Enforce that a control (an interactive element) has a text label.
  // https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/master/docs/rules/control-has-associated-label.md
  'jsx-a11y/control-has-associated-label': [
    'error',
    {
      controlComponents: [],
      depth: 5,
      ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
      ignoreRoles: [
        'grid',
        'listbox',
        'menu',
        'menubar',
        'radiogroup',
        'row',
        'tablist',
        'toolbar',
        'tree',
        'treegrid',
      ],
      labelAttributes: ['label'],
    },
  ],
  // doesn't work?
  'jsx-a11y/label-has-associated-control': [
    'error',
    {
      // airbnb uses 'both' which requires nesting i.e. <label><input /></label>
      // 'either' allows `htmlFor`
      assert: 'either',
    },
  ],
  // We are a library, we need to support it too
  'jsx-a11y/no-autofocus': 'off',
  'piplup/no-presentation-role': 'off',
};

/**
 * Accessibility of JSX: eslint-plugin-jsx-a11y's recommended rules and ours.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig({
  extends: [jsxA11yConfigs.recommended],
  files: [`**/*${EXTENSION_TS}`],
  languageOptions,
  name: 'piplup/jsx-a11y',
  plugins: { piplup: piplupPlugin },
  rules,
});
