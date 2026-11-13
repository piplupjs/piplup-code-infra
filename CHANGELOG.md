# Changelog

## 2.0.0

The configs are now named, composable pieces instead of `create*` functions, and the package adds oxlint and oxfmt support. See [Upgrading from 1.x](./README.md#upgrading-from-1x) in the README.

### Breaking changes

- `@piplup/code-infra/eslint` no longer exports `createBaseConfig`. Use `ignores(baseDirectory)` and `configs.recommended` instead, plus `nodeSupport(baseDirectory)` to check Node.js support. Instead of `enableReactCompiler: true`, add `configs.reactCompiler` after `configs.recommended`.
- `@piplup/code-infra/prettier` no longer exports `createBaseConfig`. It exports `config`, which is also the default export. To change it, spread it into your own config.
- `configs.recommended` lints more than 1.x did: `package.json` files, Markdown and MDX, and it sorts with perfectionist. It also turns on `piplup/consistent-production-guard` and `piplup/no-guarded-throw` as errors and `piplup/flatten-parentheses` as a warning. To leave a part out, list the configs you want instead.
- The peer dependencies are now ESLint 9 or 10 and Stylelint 18. ESLint 9 was required before, and Stylelint 16.

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
