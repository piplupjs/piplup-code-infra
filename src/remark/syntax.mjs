import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';

/**
 * The remark syntax extensions `createRemarkConfig` uses, without its rules. The ESLint Markdown
 * config parses with this in a project that has no remark config of its own, so front matter and
 * GitHub Flavored Markdown aren't read as plain Markdown.
 */
export default { plugins: [remarkFrontmatter, remarkGfm] };
