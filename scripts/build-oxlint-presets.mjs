/**
 * Writes the oxlint presets to src/oxlint/presets, from the ESLint configs. A test checks they're
 * up to date. Run it after changing an ESLint config or upgrading oxlint: `pnpm oxlint:presets`.
 */
import * as fs from 'node:fs/promises';

import * as prettier from 'prettier';

import { buildPresets, PRESET_FILES } from '../src/oxlint/build-presets.mjs';

const directory = new URL('../src/oxlint/presets/', import.meta.url);
await fs.mkdir(directory, { recursive: true });

const presets = await buildPresets();
for (const [name, preset] of Object.entries(presets)) {
  const file = new URL(PRESET_FILES[/** @type {keyof typeof PRESET_FILES} */ (name)], directory);
  // eslint-disable-next-line no-await-in-loop -- a handful of files
  const options = await prettier.resolveConfig(file);
  // eslint-disable-next-line no-await-in-loop -- as above
  const text = await prettier.format(JSON.stringify(preset), { ...options, parser: 'json' });
  // eslint-disable-next-line no-await-in-loop -- as above
  await fs.writeFile(file, text);
}
console.log(`Wrote ${Object.keys(presets).length} presets to src/oxlint/presets.`);
