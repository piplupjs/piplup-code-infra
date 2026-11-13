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
