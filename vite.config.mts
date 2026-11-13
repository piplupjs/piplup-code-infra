import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/setup-vitest.ts'],
    // Restore `vi.stubEnv` / `vi.stubGlobal` after each test, so stubs can't leak between tests.
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
