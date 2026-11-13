import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const oxlintRuleTester = fileURLToPath(
  new URL('./src/utils/oxlint-rule-tester.mjs', import.meta.url),
);

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/__fixtures__/**'],
    projects: [
      { extends: true, test: { name: 'unit' } },
      {
        // The piplup rule tests again, inside oxlint, which loads the rules as a JS plugin.
        extends: true,
        test: {
          alias: [
            { find: /^eslint$/, replacement: oxlintRuleTester },
            { find: /^@typescript-eslint\/rule-tester$/, replacement: oxlintRuleTester },
          ],
          include: ['src/eslint/piplup/rules/*.test.mjs'],
          name: 'oxlint-rules',
        },
      },
    ],
    setupFiles: ['./src/setup-vitest.ts'],
    // Restore `vi.stubEnv` / `vi.stubGlobal` after each test, so stubs can't leak between tests.
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
