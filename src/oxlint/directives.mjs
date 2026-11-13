/**
 * `eslint-disable` comments, applied the way ESLint applies them. oxlint applies them too, but
 * matches the rule names in them against its own plugin names, so a comment naming
 * `@typescript-eslint/naming-convention` doesn't cover the rule when oxlint runs it from the
 * typescript-eslint plugin as `typescript-js/naming-convention`.
 */

/**
 * @typedef {{ line: number, column: number }} Position
 * @typedef {{
 *   kind: 'disable' | 'enable' | 'disable-line' | 'disable-next-line',
 *   rules: string[] | null,
 *   start: Position,
 *   end: Position,
 * }} Directive
 * @typedef {{ type: string, value: string, loc: { start: Position, end: Position } }} Comment
 */

const DIRECTIVE = /^\s*eslint-(disable|enable)(-line|-next-line)?(?:\s+([\s\S]*))?$/;

/**
 * @param {Comment[]} comments
 * @returns {Directive[]}
 */
export function parseDirectives(comments) {
  /** @type {Directive[]} */
  const directives = [];
  for (const comment of comments) {
    const match = comment.value.match(DIRECTIVE);
    if (!match) {
      continue;
    }
    const [, action, scope = '', rest = ''] = match;
    const kind = /** @type {Directive['kind']} */ (`${action}${scope}`);
    // `eslint-disable` and `eslint-enable` only work in block comments.
    if ((kind === 'disable' || kind === 'enable') && comment.type !== 'Block') {
      continue;
    }
    if (kind === 'enable' && scope) {
      continue;
    }
    const rules = rest
      .replace(/\s-{2,}\s[\s\S]*$/, '')
      .split(',')
      .map((rule) => rule.trim())
      .filter(Boolean);
    directives.push({
      end: comment.loc.end,
      kind,
      rules: rules.length > 0 ? rules : null,
      start: comment.loc.start,
    });
  }
  return directives;
}

/**
 * @param {Position} a
 * @param {Position} b
 * @returns {boolean}
 */
function isBefore(a, b) {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

/**
 * Finds the directive that turns a rule off at a position, like ESLint does.
 * @param {Directive[]} directives
 * @param {(ruleName: string) => boolean} namesRule - Whether a rule name in a comment means the rule.
 * @param {Position} position - Where the problem is.
 * @returns {{ directive: Directive, ruleName: string | null } | undefined}
 */
export function findDisablingDirective(directives, namesRule, position) {
  /** @param {Directive} directive */
  const matchingName = (directive) =>
    directive.rules === null ? null : (directive.rules.find(namesRule) ?? undefined);

  for (const directive of directives) {
    const appliesToLine =
      (directive.kind === 'disable-line' && directive.start.line === position.line) ||
      (directive.kind === 'disable-next-line' && directive.end.line + 1 === position.line);
    if (appliesToLine) {
      const ruleName = matchingName(directive);
      if (ruleName !== undefined) {
        return { directive, ruleName };
      }
    }
  }

  /** @type {{ directive: Directive, ruleName: string | null } | undefined} */
  let disabled;
  for (const directive of directives) {
    if (!isBefore(directive.start, position)) {
      break;
    }
    if (directive.kind !== 'disable' && directive.kind !== 'enable') {
      continue;
    }
    const ruleName = matchingName(directive);
    if (ruleName === undefined) {
      continue;
    }
    if (directive.kind === 'disable') {
      disabled = { directive, ruleName };
    } else {
      disabled = undefined;
    }
  }
  return disabled;
}
