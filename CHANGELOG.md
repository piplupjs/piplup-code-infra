# Changelog

## Unreleased

### Fixes

- `configs.docs` no longer crashes ESLint on JSON files. The JavaScript rules of the plugins code-infra wraps, such as the Next.js ones, now do nothing in files of other languages, where `@eslint/compat` failed to create them.
- A config object without `files` can set the rules of the plugins in `configs.recommended`, as the README's example does. ESLint reported `Could not find plugin` for files no config registered the plugin for, such as JSON, so `recommended` now registers its plugins for every file.
- `react/prop-types` is off in TypeScript files. It couldn't follow imported types, so it reported props such as `style` from `React.HTMLAttributes`, which TypeScript already checks.
- In a project without a remark config, the Markdown config parses front matter and GitHub Flavored Markdown. It read front matter as Markdown before, so a `description` with a tag like `<form>` failed to parse.

## 2.0.2

### Fixes

- With npm, the React configs and presets no longer fail to load `eslint-plugin-react-hooks`. npm gave it the `zod-validation-error` 3.5.4 that `eslint-plugin-react-compiler` needs, which no longer has the `zod-validation-error/v4` that `react-hooks` loads, so the package now depends on `zod-validation-error` 4.
- With npm, the import rules no longer report `Resolve error: typescript with invalid interface loaded as resolver` on every file. eslint-plugin-import looks for `eslint-import-resolver-typescript` next to itself, where npm doesn't always put it, so `import/resolver` now gives the resolver by its path.

## 2.0.1

### Fixes

- The oxlint presets and `createOxlintConfig` ignore `node_modules` and `.git`, as ESLint always does. oxlint only skipped `node_modules` when `.gitignore` listed it, so in a project without that entry it linted every dependency, which took minutes with the presets' plugins.

## 2.0.0

The configs are now named, composable pieces instead of `create*` functions, and the package adds oxlint and oxfmt support. See [Upgrading from 1.x](./README.md#upgrading-from-1x) in the README.

### Breaking changes

- `@piplup/code-infra/eslint` no longer exports `createBaseConfig`. Use `ignores(baseDirectory)` and `configs.recommended` instead, plus `nodeSupport(baseDirectory)` to check Node.js support. Instead of `enableReactCompiler: true`, add `configs.reactCompiler` after `configs.recommended`.
- `@piplup/code-infra/prettier` no longer exports `createBaseConfig`. It exports `config`, which is also the default export. To change it, spread it into your own config.
- `configs.recommended` lints more than 1.x did: `package.json` files, Markdown and MDX, and it sorts with perfectionist. It also turns on `piplup/consistent-production-guard` and `piplup/no-guarded-throw` as errors and `piplup/flatten-parentheses` as a warning. To leave a part out, list the configs you want instead.
- The peer dependencies are now ESLint 9 or 10 and Stylelint 18. ESLint 9 was required before, and Stylelint 16.

### Fixes

- `piplup/docgen-ignore-before-comment` no longer slows linting down on long block comments. A 125 KB comment made only of `*` lines took 25 seconds. The rule now also works in files with Windows line endings.
- remark's `first-block-heading` rule no longer slows down on front matter with many blank lines.
- oxlint's `combine()` skips `__proto__` keys, which `JSON.parse` can produce, instead of replacing the prototype of the merged config.
- `import/extensions` requires file extensions in `oxlint.config.ts` and `oxfmt.config.ts`, which Node.js loads, instead of reporting them, so the README's `oxlint.config.ts` example passes linting.
- `createRemarkConfig` rejects override rule names like `toString`, which it accepted as known rules before.

### Features

- ESLint `configs`: `base`, `compat`, `imports`, `javascript`, `json`, `jsxA11y`, `markdown`, `packageJson`, `perfectionist`, `prettier`, `react`, `reactCompiler`, `spec`, `test` (Vitest and Testing Library), `typescript` and `recommended`. Each one works on its own, and every config object is named `piplup/…`.
- The `piplup` ESLint plugin is the default export of `@piplup/code-infra/eslint`. It has the configs too, for `extends: ['piplup/recommended']`.
- `@piplup/code-infra/eslint/docs` has `configs.docs` for a Next.js docs app. It needs `@next/eslint-plugin-next`.
- New rules: `piplup/add-undef-to-optional`, `piplup/consistent-production-guard`, `piplup/filename-case`, `piplup/flatten-parentheses`, `piplup/no-guarded-throw`, `piplup/no-presentation-role` and `piplup/require-dev-wrapper`.
- `@piplup/code-infra/remark` has `createRemarkConfig`, which the ESLint Markdown rules use too.
- `@piplup/code-infra/oxlint` runs the ESLint configs' rules with oxlint:
  - `presets`: `recommended`, `reactCompiler`, `test`, `spec` and `docs`.
  - `combine()` merges presets with your own config.
  - `rules()` takes rules by their ESLint names.
  - `createOxlintConfig()` builds an oxlint config from any ESLint config.
- `@piplup/code-infra/oxfmt` has `createOxfmtConfig()`, which builds an oxfmt config from a Prettier config.
