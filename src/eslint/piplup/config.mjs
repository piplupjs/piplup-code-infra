import { defineConfig } from 'eslint/config';

import { settings as importSettings, rules as importRules } from '../configs/imports.mjs';
import { rules as javascriptRules } from '../configs/javascript.mjs';
import { rules as jsxA11yRules } from '../configs/jsx-a11y.mjs';
import { rules as reactCompilerRules } from '../configs/react-compiler.mjs';
import { rules as reactRules } from '../configs/react.mjs';
import {
  consistentTypeImportsRules,
  dtsConfig,
  rules as typescriptRules,
} from '../configs/typescript.mjs';

/**
 * Our rules on top of the plugins' recommended configs, from every piece in ../configs.
 * @param {Object} [options]
 * @param {boolean} [options.enableReactCompiler] - Whether to enable React Compiler.
 * @param {boolean} [options.consistentTypeImports] - Whether to enforce consistent type imports.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createCoreConfig(options = {}) {
  return defineConfig([
    {
      name: 'piplup-core-config',
      rules: {
        ...javascriptRules,
        ...typescriptRules,
        ...importRules,
        ...reactRules,
        ...jsxA11yRules,
        ...(options.enableReactCompiler ? reactCompilerRules : {}),
        ...(options.consistentTypeImports ? consistentTypeImportsRules : {}),
      },
      settings: importSettings,
    },
    dtsConfig,
  ]);
}
