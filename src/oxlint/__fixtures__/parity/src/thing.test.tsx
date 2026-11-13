import { render } from '@testing-library/react';
import { expect, it } from 'vitest';

import { List } from './component';

it.only('renders', () => {
  const { container } = render(<List items={[]} />);
  expect(container.querySelector('div')).not.toBe(null);
});

it('has no assertion', () => {
  render(<List items={['a']} />);
});
