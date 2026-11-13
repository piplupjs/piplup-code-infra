# @piplup/code-infra

Infra scripts and shared configuration for Piplup projects.

## Overview

This package provides reusable scripts and configuration for linting and formatting setup across Piplup repositories. It is designed to be used as a base for consistent code quality and tooling.

## Usage

### Install

This package is intended to be used as a dependency in your project:

```sh
pnpm add -D @piplup/code-infra
```

### Configuration

| Entry point                      | What it provides                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@piplup/code-infra/eslint`      | `configs` (JS/TS, React, JSON, `package.json`, Markdown/MDX, tests), `ignores`, `nodeSupport`, the plugin |
| `@piplup/code-infra/eslint/docs` | `configs.docs` for a Next.js docs app (needs `@next/eslint-plugin-next`)                                  |
| `@piplup/code-infra/prettier`    | `createBaseConfig`, `docsOverrides`                                                                       |
| `@piplup/code-infra/stylelint`   | Stylelint config, including CSS-in-JS                                                                     |
| `@piplup/code-infra/remark`      | `createRemarkConfig` for `.remarkrc.mjs`; also used by the ESLint Markdown rules                          |
| `@piplup/code-infra/oxlint`      | `createOxlintConfig`: the ESLint rules above, run by oxlint                                               |
| `@piplup/code-infra/oxfmt`       | `createOxfmtConfig`, `docsOverrides`: the Prettier config above, for oxfmt                                |

`eslint.config.mjs`:

```js
import { configs, ignores, nodeSupport } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ignores(import.meta.dirname),
  configs.recommended,
  nodeSupport(import.meta.dirname),
  {
    files: ['**/*.test.?(c|m)[jt]s?(x)'],
    extends: [configs.test],
  },
);
```

- `configs.recommended` holds every config below except `reactCompiler`, `test` and `spec`. Each config can also be used on its own: it sets its own `files` and registers the plugins it needs.
- The configs are `base`, `compat`, `imports`, `javascript`, `json`, `jsxA11y`, `markdown`, `packageJson`, `perfectionist`, `prettier`, `react`, `reactCompiler`, `spec` (for `*.spec.*` files), `test` (Vitest and Testing Library, with no `files`, so scope it to your tests) and `typescript`. Every config object is named `piplup/…`, which the ESLint config inspector shows.
- `ignores(dir)` ignores the files in `.gitignore` and `.lintignore`. `nodeSupport(dir)` checks the sources of the `packages*/*` packages that declare `engines.node` for syntax and APIs those Node.js versions don't support.
- The configs are also on the default export, the `piplup` plugin, for `extends: ['piplup/recommended']` in a config object that registers it as `plugins: { piplup }`.
- To allow inline `type` imports, turn off `@typescript-eslint/consistent-type-imports` and `import/consistent-type-specifier-style`.

To require kebab-case file names, turn on `piplup/filename-case`. It's off by default because many React projects name component files in PascalCase. Its `ignore` option takes regular expressions for file names to skip:

```js
{
  rules: {
    'piplup/filename-case': ['error', { ignore: ['^[A-Z][A-Za-z]*\\.tsx$'] }],
  },
}
```

`.remarkrc.mjs`:

```js
import { createRemarkConfig } from '@piplup/code-infra/remark';

export default createRemarkConfig();
```

## oxlint and oxfmt

oxlint and oxfmt can replace ESLint and Prettier for JavaScript and TypeScript. They run the same rules and format the same way.

`oxlint.config.ts`:

```ts
import { createOxlintConfig } from '@piplup/code-infra/oxlint';

export default await createOxlintConfig({ baseDirectory: import.meta.dirname });
```

`createOxlintConfig` reads the rules from the ESLint config, so it needs `eslint` installed. It takes `enableReactCompiler` (adds `configs.reactCompiler`), `consistentTypeImports` (`false` allows inline `type` imports) and `docs` (`true`, or `{ rootDir }`) for the `configs.docs` rules. It enables the test file rules for `**/*.test.*` files. oxlint runs a rule natively when it implements it. Otherwise it loads the rule's ESLint plugin, because oxlint has no native version of it.

`.oxfmtrc.json` can't import a config, so use `oxfmt.config.ts`:

```ts
import { createOxfmtConfig } from '@piplup/code-infra/oxfmt';

export default createOxfmtConfig();
```

oxlint only lints JavaScript and TypeScript. To keep linting JSON, `package.json` and Markdown, run ESLint on those files alone:

```js
import { configs, ignores } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ignores(import.meta.dirname),
  configs.base,
  configs.json,
  configs.packageJson,
  configs.markdown,
);
```

Differences from ESLint:

- oxlint reserves the names of its own plugins. A rule it loads from an ESLint plugin with the same name runs under a `-js` name, for example `react-js/prop-types` or `typescript-js/naming-convention`, and that's the name its reports show. `eslint-disable` comments with the ESLint name still turn these rules off. But oxlint reports those comments as unused when it runs with `--report-unused-disable-directives`.
- Rules that need type information, such as `@typescript-eslint/no-deprecated` in the docs config, only run when [`oxlint-tsgolint`](https://oxc.rs/docs/guide/usage/linter/type-aware.html) is installed.
- After upgrading oxlint, run `pnpm oxlint:update-rules` in this repository, so the config knows which rules oxlint implements natively.
