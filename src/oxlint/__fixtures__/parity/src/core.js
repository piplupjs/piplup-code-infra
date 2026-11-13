var legacy = 1;
debugger;

export function compare(a, b) {
  if (a == b) {
    return true;
  } else {
    return legacy;
  }
}

export function sometimes(value) {
  if (value) {
    return 1;
  }
}

export function loop(items) {
  for (const key in items) {
    console.log(key);
  }
  let count = 0;
  count++;
  return items['length'] + count;
}

//no space after the slashes
export const self = this;
