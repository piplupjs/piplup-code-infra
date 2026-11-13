import { defineConfig } from 'eslint/config';

import { configs as reactCompilerConfigs } from '../../lint/plugins/react-compiler.mjs';
import { EXTENSION_TS } from '../extensions.mjs';

/**
 * React Compiler checks. Opt-in: only for projects that build with React Compiler.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  'react-compiler/react-compiler': 'error',
};

/**
 * React Compiler checks. Not part of `recommended`.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig({
  extends: [reactCompilerConfigs.recommended],
  files: [`**/*${EXTENSION_TS}`],
  name: 'piplup/react-compiler',
  rules,
});
