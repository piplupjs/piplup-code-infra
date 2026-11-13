import { describe, it, expect } from 'vitest';

import { createLintTester } from './create-lint-tester.mjs';
import plugin from './straight-quotes.mjs';

const lint = createLintTester(plugin);

describe('remark-lint-piplup-straight-quotes', () => {
  it('accepts straight quotes', () => {
    expect(lint(`# Title\n\nA paragraph with "straight" and 'simple' quotes.\n`)).toEqual([]);
  });

  it('flags curly double quotes with correct location', () => {
    const messages = lint(`# Title\n\nA paragraph with “curly” quotes.\n`);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ column: 18, line: 3 });
    expect(messages[1]).toMatchObject({ column: 24, line: 3 });
  });

  it('flags curly single quotes', () => {
    const messages = lint(`Use ‘single’ curly quotes too.\n`);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ column: 5, line: 1 });
    expect(messages[1]).toMatchObject({ column: 12, line: 1 });
  });
});
