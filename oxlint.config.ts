import eslintConfig from './eslint.config.mjs';
import { createOxlintConfig } from './src/oxlint/index.mjs';

// Built from the ESLint config, so oxlint runs the same rules on the same files.
export default await createOxlintConfig(eslintConfig, { baseDirectory: import.meta.dirname });
