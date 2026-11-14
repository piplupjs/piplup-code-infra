import prettierConfig from './prettier.config.mjs';
import { createOxfmtConfig } from './src/oxfmt.mjs';

// Built from the Prettier config, so oxfmt formats the same way.
export default createOxfmtConfig(prettierConfig);
