import { lintRule } from 'unified-lint-rule';
import { visit } from 'unist-util-visit';

const remarkLintPiplupTerminalLanguage = lintRule(
  {
    origin: 'remark-lint:piplup-terminal-language',
    url: 'https://github.com/piplupjs/piplup-code-infra',
  },
  /** @param {import('mdast').Root} tree */
  (tree, file) => {
    visit(tree, 'code', (node) => {
      if (node.lang === 'sh' && node.position) {
        file.message('Use `bash` instead of `sh` as the code block language.', node);
      }
    });
  },
);

export default remarkLintPiplupTerminalLanguage;
