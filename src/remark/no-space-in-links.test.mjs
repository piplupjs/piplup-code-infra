import { describe, it, expect } from 'vitest';

import { createLintTester } from './create-lint-tester.mjs';
import plugin from './no-space-in-links.mjs';

const lint = createLintTester(plugin);

describe('remark-lint-piplup-no-space-in-links', () => {
  it('accepts links without surrounding whitespace', () => {
    expect(lint(`[link text](https://example.com)\n`)).toEqual([]);
    expect(lint(`Some [inline](https://example.com) text.\n`)).toEqual([]);
  });

  it('flags leading whitespace in link text', () => {
    const messages = lint(`[ link text ](https://example.com)\n`);
    expect(messages).toHaveLength(1);
  });

  it('flags trailing whitespace in link text', () => {
    const messages = lint(`[trailing ](https://example.com)\n`);
    expect(messages).toHaveLength(1);
  });
});
