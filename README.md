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

| Entry point                      | What it provides                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@piplup/code-infra/eslint`      | `createBaseConfig` (JS/TS, React, JSON, `package.json`, Markdown/MDX, Node.js support), `createTestConfig` |
| `@piplup/code-infra/eslint/docs` | `createDocsConfig` for a Next.js docs app (needs `@next/eslint-plugin-next`)                               |
| `@piplup/code-infra/prettier`    | `createBaseConfig`, `docsOverrides`                                                                        |
| `@piplup/code-infra/stylelint`   | Stylelint config, including CSS-in-JS                                                                      |
| `@piplup/code-infra/remark`      | `createRemarkConfig` for `.remarkrc.mjs`; also used by the ESLint Markdown rules                           |

`eslint.config.mjs`:

```js
import { createBaseConfig, createTestConfig } from '@piplup/code-infra/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(createBaseConfig({ baseDirectory: import.meta.dirname }), {
  files: ['**/*.test.?(c|m)[jt]s?(x)'],
  extends: createTestConfig(),
});
```

`.remarkrc.mjs`:

```js
import { createRemarkConfig } from '@piplup/code-infra/remark';

export default createRemarkConfig();
```

## CLI

The package installs a `code-infra` binary. Run `pnpm code-infra <command> --help` for each command's options.

| Command                 | What it does                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `copy-files`            | Copies files (README, LICENSE, globs) into a package's build output                     |
| `validate-built-types`  | Checks a package's built `.d.ts` files for imports of local files that aren't published |
| `list-workspaces`       | Lists the workspace packages, optionally only the public or private ones                |
| `publish`               | Publishes the public packages and creates the GitHub release                            |
| `publish-canary`        | Publishes canary versions of the packages changed since the last canary                 |
| `publish-new-package`   | Publishes an empty first version of packages that aren't on npm yet                     |
| `generate-changelog`    | Generates a changelog from the merged pull requests since the last version tag          |
| `baseline`              | Prints the commit a branch should be compared against                                   |
| `rename-scope`          | Renames the npm scope of the workspace packages                                         |
| `set-version-overrides` | Sets pnpm overrides for a dependency version, e.g. to test against another React        |

### GitHub access

Commands that call the GitHub API read a token from `GITHUB_TOKEN` or `GH_TOKEN`. On a developer machine without either, they use the [GitHub CLI](https://cli.github.com/) token, so run `gh auth login` once.

The repository's root `package.json` `repository` field decides which remote is the canonical one: `upstream` or `origin`, whichever points at a GitHub repository of that owner. Without the field, any GitHub remote counts.

### Adding and publishing new packages

npm Trusted Publishing only works for packages that already exist on npm. Before the publish workflow can publish a new public package, publish it once by hand:

1. Log in to npm:

   ```bash
   npm login
   ```

2. Publish an empty first version of the packages that aren't on npm yet. The command lists them and asks before publishing. Add `--dryRun` to try it first, or `--otp=<code>` if npm asks for a one-time password:

   ```bash
   pnpm code-infra publish-new-package
   ```

3. On npm, open each new package's settings (`https://www.npmjs.com/package/<name>/access`) and add a Trusted Publisher for GitHub Actions, naming the repository and the publish workflow file.

4. Under **Publishing access**, require two-factor authentication and disallow tokens, then save.

Then run the publish workflow again.
