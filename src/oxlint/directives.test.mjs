import { describe, expect, it } from 'vitest';

import { findDisablingDirective, parseDirectives } from './directives.mjs';

/**
 * @param {'Line' | 'Block'} type
 * @param {string} value
 * @param {number} line
 * @param {number} [endLine]
 */
function comment(type, value, line, endLine = line) {
  return {
    type,
    value,
    loc: { start: { line, column: 0 }, end: { line: endLine, column: value.length + 4 } },
  };
}

describe('parseDirectives', () => {
  it('reads the kind and rules, without the description', () => {
    expect(
      parseDirectives([
        comment('Line', ' eslint-disable-next-line react/prop-types, no-var -- legacy', 1),
        comment('Line', ' eslint-disable-line', 2),
        comment('Block', ' eslint-disable import/order ', 3),
        comment('Block', ' eslint-enable ', 4),
        comment('Line', ' just a comment', 5),
      ]).map(({ kind, rules }) => ({ kind, rules })),
    ).toEqual([
      { kind: 'disable-next-line', rules: ['react/prop-types', 'no-var'] },
      { kind: 'disable-line', rules: null },
      { kind: 'disable', rules: ['import/order'] },
      { kind: 'enable', rules: null },
    ]);
  });

  it('ignores `eslint-disable` in line comments, like ESLint', () => {
    expect(parseDirectives([comment('Line', ' eslint-disable no-var', 1)])).toEqual([]);
  });
});

describe('findDisablingDirective', () => {
  /** @param {string} name */
  const isPropTypes = (name) => name === 'react/prop-types';

  it('applies `-next-line` to the line after the comment', () => {
    const directives = parseDirectives([
      comment('Block', ' eslint-disable-next-line react/prop-types ', 1, 2),
    ]);
    expect(findDisablingDirective(directives, isPropTypes, { line: 2, column: 0 })).toBeUndefined();
    expect(findDisablingDirective(directives, isPropTypes, { line: 3, column: 0 })).toMatchObject({
      ruleName: 'react/prop-types',
    });
  });

  it('applies `-line` to its own line only', () => {
    const directives = parseDirectives([comment('Line', ' eslint-disable-line', 4)]);
    expect(findDisablingDirective(directives, isPropTypes, { line: 4, column: 9 })).toMatchObject({
      ruleName: null,
    });
    expect(findDisablingDirective(directives, isPropTypes, { line: 5, column: 0 })).toBeUndefined();
  });

  it('applies a block `disable` until the matching `enable`', () => {
    const directives = parseDirectives([
      comment('Block', ' eslint-disable react/prop-types ', 2),
      comment('Block', ' eslint-enable react/prop-types ', 6),
    ]);
    expect(findDisablingDirective(directives, isPropTypes, { line: 1, column: 0 })).toBeUndefined();
    expect(findDisablingDirective(directives, isPropTypes, { line: 4, column: 0 })).toBeDefined();
    expect(findDisablingDirective(directives, isPropTypes, { line: 7, column: 0 })).toBeUndefined();
  });

  it('only matches the rules it names', () => {
    const directives = parseDirectives([comment('Line', ' eslint-disable-next-line no-var', 1)]);
    expect(findDisablingDirective(directives, isPropTypes, { line: 2, column: 0 })).toBeUndefined();
  });
});
