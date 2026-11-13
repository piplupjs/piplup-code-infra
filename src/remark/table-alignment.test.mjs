import { describe, it, expect } from 'vitest';

import { createLintTester } from './create-lint-tester.mjs';
import plugin from './table-alignment.mjs';

const lint = createLintTester(plugin);

describe('remark-lint-piplup-table-alignment', () => {
  it('accepts tables with explicit alignment on every column', () => {
    const input = `| A | B |\n| :- | -: |\n| 1 | 2 |\n`;
    expect(lint(input)).toEqual([]);
  });

  it('flags tables with at least one column missing alignment', () => {
    const input = `| A | B |\n| :- | -- |\n| 1 | 2 |\n`;
    const messages = lint(input);
    expect(messages).toHaveLength(1);
  });

  it('flags tables with no alignment at all', () => {
    const input = `| A | B |\n| - | - |\n| 1 | 2 |\n`;
    const messages = lint(input);
    expect(messages).toHaveLength(1);
  });

  it('does not flag non-table content', () => {
    expect(lint(`# Heading\n\nSome paragraph.\n`)).toEqual([]);
  });
});
