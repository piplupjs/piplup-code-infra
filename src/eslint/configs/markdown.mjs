import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'eslint/config';
import * as mdx from 'eslint-plugin-mdx';

const REMARK_CONFIG_FILES = ['', '.json', '.js', '.cjs', '.mjs', '.yml', '.yaml'].map(
  (extension) => `.remarkrc${extension}`,
);

/** The remark config with only the syntax extensions, for projects without their own. */
const REMARK_SYNTAX_CONFIG = fileURLToPath(new URL('../../remark/syntax.mjs', import.meta.url));

/**
 * Whether `directory` or a directory above it has a remark config, where eslint-mdx looks for
 * one: a `.remarkrc` file or a `remarkConfig` field in `package.json`.
 * @param {string} directory
 * @returns {boolean}
 */
function hasRemarkConfig(directory) {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    if (REMARK_CONFIG_FILES.some((file) => fs.existsSync(path.join(current, file)))) {
      return true;
    }
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        if (JSON.parse(fs.readFileSync(packageJson, 'utf8')).remarkConfig) {
          return true;
        }
      } catch {
        // An unreadable package.json has no remark config for us.
      }
    }
    if (path.dirname(current) === current) {
      return false;
    }
  }
}

/** @type {Map<string, boolean>} */
const remarkConfigCache = new Map();

/**
 * The parser options for a Markdown file: with the syntax-only remark config when no remark
 * config of the project's own is above the file, so front matter isn't read as Markdown.
 * @param {Record<string, unknown> | undefined} parserOptions
 * @param {string | undefined} filePath
 * @returns {Record<string, unknown>}
 */
function markdownParserOptions(parserOptions, filePath) {
  if (parserOptions?.remarkConfigPath) {
    return parserOptions;
  }
  const directory = path.dirname(path.resolve(filePath ?? 'file.md'));
  let found = remarkConfigCache.get(directory);
  if (found === undefined) {
    found = hasRemarkConfig(directory);
    remarkConfigCache.set(directory, found);
  }
  return found
    ? { ...parserOptions }
    : { ...parserOptions, remarkConfigPath: REMARK_SYNTAX_CONFIG };
}

const mdxParser = /** @type {import('eslint').Linter.Parser & { parseForESLint: Function }} */ (
  mdx.flat.languageOptions?.parser
);
const mdxPlugin = /** @type {import('eslint').ESLint.Plugin} */ (mdx.flat.plugins?.mdx);
const remarkRule = /** @type {import('eslint').Rule.RuleModule} */ (mdxPlugin.rules?.remark);

/**
 * eslint-mdx's parser, with `markdownParserOptions`.
 * @type {import('eslint').Linter.Parser}
 */
const markdownParser = {
  meta: { name: 'piplup/markdown-parser' },
  parseForESLint(code, options = {}) {
    return mdxParser.parseForESLint(code, markdownParserOptions(options, options.filePath));
  },
};

/**
 * eslint-plugin-mdx, whose `mdx/remark` rule, which parses the file again, uses
 * `markdownParserOptions` too.
 * @type {import('eslint').ESLint.Plugin}
 */
const markdownPlugin = {
  ...mdxPlugin,
  rules: {
    ...mdxPlugin.rules,
    remark: {
      ...remarkRule,
      create(context) {
        const languageOptions = {
          ...context.languageOptions,
          parserOptions: markdownParserOptions(
            /** @type {Record<string, unknown> | undefined} */ (
              context.languageOptions?.parserOptions
            ),
            context.filename,
          ),
        };
        return remarkRule.create(
          Object.create(context, { languageOptions: { value: languageOptions } }),
        );
      },
    },
  },
};

/**
 * Markdown and MDX, through eslint-plugin-mdx. Severities for the Markdown checks live in the
 * project's `.remarkrc` (see `@piplup/code-infra/remark`), not here. Without a remark config of
 * the project's own, it parses with remark's front matter and GitHub Flavored Markdown extensions.
 * @type {import('eslint').Linter.Config[]}
 */
export const config = defineConfig(
  {
    ...mdx.flat,
    languageOptions: { ...mdx.flat.languageOptions, parser: markdownParser },
    name: 'piplup/markdown',
    plugins: { mdx: markdownPlugin },
    rules: {
      ...mdx.flat.rules,
      'mdx/remark': 'error',
    },
  },
  { ...mdx.flatCodeBlocks, name: 'piplup/markdown/code-blocks' },
);
