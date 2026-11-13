export function check(value: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('Missing value');
    }
  }
}
