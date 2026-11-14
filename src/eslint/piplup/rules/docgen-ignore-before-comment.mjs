const STAR_LINE = /^ *\*/;
const IGNORE_LINE = /^ *\* @ignore$/;

/**
 * Whether a block comment has `@ignore` on a line after another comment line, as in:
 *
 * ```
 * /**
 *  * Comment.
 *  * @ignore
 *  *\/
 * ```
 *
 * It looks for a line ending in `*`, like the `/**` line, then one or more lines beginning with
 * `*`, then the `* @ignore` line, then any number of lines beginning with `*`, then a line
 * beginning with a space, like the one before `*\/`. All lines can begin with any number of
 * spaces.
 *
 * Each line is looked at a fixed number of times, so a long comment can't slow linting down the
 * way a backtracking regular expression would.
 * @param {string} value - The comment's text, without `/*` and `*\/`.
 * @returns {boolean}
 */
function hasIgnoreAfterContent(value) {
  const lines = value.split(/\r?\n/);

  // closes[i]: lines[i] begins with a space, or begins with `*` and so does each line after it,
  // up to one that begins with a space.
  const closes = Array.from({ length: lines.length + 1 }, () => false);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    closes[index] =
      lines[index].startsWith(' ') || (STAR_LINE.test(lines[index]) && closes[index + 1]);
  }

  // Where the run of lines beginning with `*` up to the line before this one starts.
  let runStart = 0;
  // The last line, at least two lines before this one, that ends in `*`.
  let lastEndingInStar = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (index >= 2 && lines[index - 2].endsWith('*')) {
      lastEndingInStar = index - 2;
    }
    if (
      index >= 2 &&
      IGNORE_LINE.test(lines[index]) &&
      runStart <= index - 1 &&
      lastEndingInStar >= 0 &&
      lastEndingInStar >= runStart - 1 &&
      closes[index + 1]
    ) {
      return true;
    }
    if (!STAR_LINE.test(lines[index])) {
      runStart = index + 1;
    }
  }
  return false;
}

export default /** @type {import('eslint').Rule.RuleModule} */ ({
  create: (context) => {
    const { sourceCode } = context;
    sourceCode.getAllComments().forEach((comment) => {
      if (comment.type === 'Block' && hasIgnoreAfterContent(comment.value)) {
        context.report({
          messageId: 'ignoreBeforeComment',
          node: comment,
        });
      }
    });

    return {};
  },
  meta: {
    messages: {
      ignoreBeforeComment: '@ignore should be at the beginning of a block comment.',
    },
  },
});
