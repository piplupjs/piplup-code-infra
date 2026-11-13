import { ChangeEvent } from 'react';

// @ts-ignore
export const bad_Name = 1;

export function handle(event: ChangeEvent<HTMLInputElement>): string {
  const unused = 2;
  return event.target.value;
}
