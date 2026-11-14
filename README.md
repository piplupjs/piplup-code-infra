# @piplup/code-infra

Shared linting and formatting configuration for Piplup projects: ESLint, Prettier, Stylelint and remark, and oxlint and oxfmt with the same rules and formatting.

## Install

```sh
pnpm add -D @piplup/code-infra
```

| Entry point                      | What it provides                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@piplup/code-infra/eslint`      | `configs` (JS/TS, React, JSON, `package.json`, Markdown/MDX, tests), `ignores`, `nodeSupport`, the plugin |
| `@piplup/code-infra/eslint/docs` | `configs.docs` for a Next.js docs app (needs `@next/eslint-plugin-next`)                                  |
| `@piplup/code-infra/prettier`    | `config` (also the default export), `docsOverrides`                                                       |
| `@piplup/code-infra/stylelint`   | Stylelint config, including CSS-in-JS                                                                     |
| `@piplup/code-infra/remark`      | `createRemarkConfig` for `.remarkrc.mjs`; also used by the ESLint Markdown rules                          |
| `@piplup/code-infra/oxlint`      | `presets`, `combine`, `rules`, and `createOxlintConfig` for an ESLint config's rules, run by oxlint       |
| `@piplup/code-infra/oxfmt`       | `createOxfmtConfig`: a Prettier config, for oxfmt                                                         |

## ESLint

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
  {
    // Your own changes come last, so they win.
    rules: {
      'react/prop-types': 'off',
    },
  },
);
```

- `configs.recommended` holds every config below except `reactCompiler`, `test` and `spec`. Each config can also be used on its own: it sets its own `files` and registers the plugins it needs. To leave one out, list the ones you want instead of `configs.recommended`.
- The configs are `base`, `compat`, `imports`, `javascript`, `json`, `jsxA11y`, `markdown`, `packageJson`, `perfectionist`, `prettier`, `react`, `reactCompiler`, `spec` (for `*.spec.*` files), `test` (Vitest and Testing Library, with no `files`, so scope it to your tests) and `typescript`. Every config object is named `piplup/…`, which the ESLint config inspector shows.
- `ignores(dir)` ignores the files in `.gitignore` and `.lintignore`. `nodeSupport(dir)` checks the sources of the `packages*/*` packages that declare `engines.node` for syntax and APIs those Node.js versions don't support.
- The configs are also on the default export, the `piplup` plugin, for `extends: ['piplup/recommended']` in a config object that registers it as `plugins: { piplup }`.
- To allow inline `type` imports, turn off `@typescript-eslint/consistent-type-imports` and `import/consistent-type-specifier-style`.

For a Next.js docs app, add `configs.docs`, scoped to it. It expects the app in `docs`; for another directory, set `settings.next.rootDir` too:

```js
import { configs as docsConfigs } from '@piplup/code-infra/eslint/docs';

// After the configs above:
{
  files: ['website/**'],
  extends: [docsConfigs.docs],
  settings: { next: { rootDir: 'website' } },
}
```

To require kebab-case file names, turn on `piplup/filename-case`. It's off by default because many React projects name component files in PascalCase. Its `ignore` option takes regular expressions for file names to skip:

```js
{
  rules: {
    'piplup/filename-case': ['error', { ignore: ['^[A-Z][A-Za-z]*\\.tsx$'] }],
  },
}
```

## Prettier

`prettier.config.mjs`:

```js
export { default } from '@piplup/code-infra/prettier';
```

To change it, spread `config`. For example, `docsOverrides` narrows the print width of docs sources:

```js
import { config, docsOverrides } from '@piplup/code-infra/prettier';

export default { ...config, overrides: [...config.overrides, ...docsOverrides] };
```

## Stylelint and remark

`stylelint.config.mjs`:

```js
export default { extends: '@piplup/code-infra/stylelint' };
```

`.remarkrc.mjs`, which the ESLint Markdown rules use too:

```js
import { createRemarkConfig } from '@piplup/code-infra/remark';

export default createRemarkConfig();
```

## oxlint and oxfmt

oxlint and oxfmt can replace ESLint and Prettier for JavaScript and TypeScript. They run the same rules and format the same way.

### oxlint presets

The presets need no ESLint config, so they load fast. `oxlint.config.ts`:

```ts
import { combine, presets, rules } from '@piplup/code-infra/oxlint';

export default combine(presets.recommended, presets.test, {
  rules: rules({
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react/prop-types': 'off',
  }),
});
```

- `presets.recommended` has the JavaScript and TypeScript rules of `configs.recommended`. The others add to it, so list them after it: `reactCompiler`, `test` for `*.test.*` files, `spec` for `*.spec.*` files, and `docs` for a Next.js app in `docs`.
- `combine()` merges the presets and your config into one, with later configs winning, as in an ESLint flat config. A rule you set at the top level applies to every file, including the files a preset has its own rules for, like test files. Use `combine()` rather than oxlint's `extends`, which drops the `settings` and `options` of the configs it extends, such as the React version, the browsers for `compat/compat` and type-aware linting.
- `rules()` takes rules by their ESLint names and gives them the names the presets use in oxlint: oxlint's own name for a rule it implements, like `no-unused-vars` for `@typescript-eslint/no-unused-vars`, and the plugin's `-js` name for a rule it runs from an ESLint plugin, like `react-js/prop-types`.
- The React version and type-aware linting are set when the config loads.

### oxlint from your ESLint config

If you've changed the ESLint config, build the oxlint config from it, so oxlint runs what ESLint runs. `oxlint.config.ts`:

```ts
import { createOxlintConfig } from '@piplup/code-infra/oxlint';

import eslintConfig from './eslint.config.mjs';

export default await createOxlintConfig(eslintConfig, { baseDirectory: import.meta.dirname });
```

`createOxlintConfig` takes an ESLint config, anything `defineConfig` takes, and builds an oxlint config with the same rules, options and globals for each file. It loads ESLint and its plugins, so it starts slower than the presets.

- Each ESLint config object for some of the files becomes an oxlint override, from its `files` and `ignores`. The global `ignores` become `ignorePatterns`. oxlint reads those patterns relative to the config file, so keep `oxlint.config.ts` in `baseDirectory`, next to `eslint.config.mjs`.
- It asks ESLint about the repository's files, and about made-up files for each override. A file the overrides can't describe gets an override that lists it, for example when a config's `files` is a function. Files added later aren't in that list, so build the config again.
- Rules from a plugin it has no route for make it throw. Turn those rules off for oxlint, or keep linting those files with ESLint.

### oxfmt

`.oxfmtrc.json` can't import a config, so use `oxfmt.config.ts`:

```ts
import { createOxfmtConfig } from '@piplup/code-infra/oxfmt';

export default createOxfmtConfig();
```

`createOxfmtConfig()` formats like the Prettier config from `@piplup/code-infra/prettier`. Pass it your own Prettier config to keep your changes, for example `createOxfmtConfig(prettierConfig)` with `import prettierConfig from './prettier.config.mjs'`. It turns off oxfmt's sorting of imports, `package.json` keys and Tailwind classes, which Prettier doesn't do, and leaves out Prettier `plugins`, which oxfmt can't load.

### Running oxlint and ESLint together

oxlint only lints JavaScript and TypeScript. To keep linting JSON, `package.json` and Markdown, run ESLint on those files alone. `eslint.config.mjs`:

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

`package.json`:

```json
{
  "scripts": {
    "lint": "oxlint && eslint ."
  }
}
```

### Differences from ESLint

- oxlint reserves the names of its own plugins. A rule it loads from an ESLint plugin with the same name runs under a `-js` name, for example `react-js/prop-types` or `typescript-js/naming-convention`, and that's the name its reports show. `eslint-disable` comments with the ESLint name still turn these rules off. But oxlint reports those comments as unused when it runs with `--report-unused-disable-directives`.
- Rules that need type information, such as `@typescript-eslint/no-deprecated` in the docs config, only run when [`oxlint-tsgolint`](https://oxc.rs/docs/guide/usage/linter/type-aware.html) is installed.

## Upgrading from 1.x

2.0 replaces the `createBaseConfig` functions with named configs that you list yourself. The Stylelint config is used the same way as before. oxlint and oxfmt support is new and optional.

| 1.x                                                                    | 2.0                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `createBaseConfig({ baseDirectory })` from `@piplup/code-infra/eslint` | `ignores(baseDirectory)`, `configs.recommended` and, optionally, `nodeSupport(baseDirectory)` |
| `enableReactCompiler: true`                                            | `configs.reactCompiler`, after `configs.recommended`                                          |
| `createBaseConfig({ overrides })` from `@piplup/code-infra/prettier`   | `config`, spread into your own config                                                         |
| Stylelint 16                                                           | Stylelint 18                                                                                  |

### 1. Update the packages

```sh
pnpm add -D @piplup/code-infra@^2.0.0
```

If you use the Stylelint config, update Stylelint to 18 too. It needs Node.js 22.22.2, 24.15.0 or 26 or later:

```sh
pnpm add -D stylelint@^18.0.0
```

ESLint 9 and 10 both work, and any Prettier 3 release.

### 2. Update `eslint.config.mjs`

1.x:

```js
import { createBaseConfig } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  createBaseConfig({ baseDirectory: import.meta.dirname, enableReactCompiler: true }),
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
);
```

2.0:

```js
import { configs, ignores, nodeSupport } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ignores(import.meta.dirname),
  configs.recommended,
  // Only if you had enableReactCompiler: true.
  configs.reactCompiler,
  // Optional and new: checks Node.js support in packages that declare "engines.node".
  nodeSupport(import.meta.dirname),
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
);
```

- `ignores()` reads `.gitignore` and `.lintignore`, as `createBaseConfig` did. Pass the directory they're in: `createBaseConfig` used the current directory when you didn't pass `baseDirectory`, but `ignores()` has no default.
- `compat/compat` finds the browsers to support in the nearest `.browserslistrc` or `package.json` `"browserslist"` above each file. 1.x only read `.browserslistrc` from `baseDirectory`.
- Your own config objects still go last, so their rules win.

### 3. Update `prettier.config.mjs`

Without overrides, re-export the config:

```js
export { default } from '@piplup/code-infra/prettier';
```

With overrides, 1.x:

```js
import { createBaseConfig } from '@piplup/code-infra/prettier';

export default createBaseConfig({
  overrides: [{ files: ['*.md'], options: { proseWrap: 'always' } }],
});
```

2.0:

```js
import { config } from '@piplup/code-infra/prettier';

export default {
  ...config,
  overrides: [...config.overrides, { files: ['*.md'], options: { proseWrap: 'always' } }],
};
```

Keep `...config.overrides`: it holds the JSON override that turns off trailing commas.

### 4. Fix the new reports

`configs.recommended` checks more than `createBaseConfig` did, so expect new reports on the first run:

- **Sorting.** perfectionist sorts object keys, imports, JSX props and more. `eslint --fix` fixes these.
- **`package.json` files**, through `configs.packageJson`.
- **Markdown and MDX**, through `configs.markdown`. Add a `.remarkrc.mjs` (see [Stylelint and remark](#stylelint-and-remark)) for the Markdown rules.
- **New piplup rules:** `piplup/consistent-production-guard` and `piplup/no-guarded-throw` report errors, and `piplup/flatten-parentheses` warns.

Run the fixable ones first, then look at what's left:

```sh
pnpm eslint . --fix
```

To adopt these one at a time, list the configs you want instead of `configs.recommended`. This is the order `recommended` uses, without `packageJson`, `markdown` and `perfectionist`, so it's closest to 1.x:

```js
import { configs, ignores } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ignores(import.meta.dirname),
  configs.base,
  configs.json,
  configs.prettier,
  configs.javascript,
  configs.imports,
  configs.jsxA11y,
  configs.react,
  configs.typescript,
  configs.compat,
  {
    rules: {
      'piplup/consistent-production-guard': 'off',
      'piplup/flatten-parentheses': 'off',
      'piplup/no-guarded-throw': 'off',
    },
  },
);
```

### 5. Optional: lint tests and try oxlint

- For Vitest and Testing Library rules, add `configs.test` scoped to your test files, as in the [ESLint](#eslint) example.
- To run the same rules faster, see [oxlint and oxfmt](#oxlint-and-oxfmt).

## Maintaining

After upgrading oxlint, run `pnpm oxlint:update-rules` and then `pnpm oxlint:presets`, so the configs know which rules oxlint implements natively. After changing an ESLint config, run `pnpm oxlint:presets`; a test fails while the presets are out of date.
