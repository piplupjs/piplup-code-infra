/// <reference types="../estree-typescript" />
/// <reference types="../untyped-plugins" />

export * from './base-config.mjs';
export { configs } from './configs/index.mjs';
export * from './extensions.mjs';
export { ignores } from './ignores.mjs';
export * from './node-support-config.mjs';
export { createNodeSupportConfig as nodeSupport } from './node-support-config.mjs';
export { default } from './plugin.mjs';
export * from './test-config.mjs';
