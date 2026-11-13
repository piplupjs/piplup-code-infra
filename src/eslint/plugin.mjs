import { configs } from './configs/index.mjs';
import piplupPlugin from './piplup/index.mjs';

Object.assign(piplupPlugin.configs, configs);

/**
 * The piplup ESLint plugin: our rules, and the configs, so `extends: ['piplup/recommended']` works
 * once the plugin is registered as `piplup`. It's the same object the configs register, so
 * registering it yourself doesn't conflict with them.
 */
export default piplupPlugin;
