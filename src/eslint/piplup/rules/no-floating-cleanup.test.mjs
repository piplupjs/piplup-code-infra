import TSESlintParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

import rule from './no-floating-cleanup.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: TSESlintParser,
  },
});

ruleTester.run('no-floating-cleanup', /** @type {any} */ (rule), {
  valid: [
    {
      name: 'stored cleanup function',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
function f() {
  const un = subscribe(() => {});
  un();
}
      `,
    },
    {
      name: 'explicit void opt-out',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
function f() {
  void subscribe(() => {});
}
      `,
    },
    {
      name: 'call returning void',
      code: `
declare function noop(): void;
function f() {
  noop();
}
      `,
    },
    {
      name: 'fluent builder methods returning `this`',
      code: `
interface Scale {
  (value: number): number;
  domain(d: number[]): this;
  range(r: number[]): this;
}
declare const scale: Scale;
function f() {
  scale.domain([0, 1]);
  scale.range([0, 100]);
}
      `,
    },
    {
      name: 'fluent builder method with an inferred `this` return',
      code: `
class Builder {
  configure() {
    return this;
  }
}
declare const builder: Builder;
function f() {
  builder.configure();
}
      `,
    },
    {
      name: 'imported function the file cannot see',
      code: `
import { subscribe } from './store';
subscribe(() => {});
      `,
    },
    {
      name: 'un-awaited async function returning a cleanup',
      code: `
async function connect() {
  return () => {};
}
connect();
      `,
    },
    {
      name: 'function returning a non-function value',
      code: `
function count() {
  return 1;
}
count();
      `,
    },
    {
      name: 'interface without a call signature',
      code: `
interface Result {
  value: number;
}
declare function load(): Result;
load();
      `,
    },
  ],
  invalid: [
    {
      name: 'function whose body returns a cleanup function',
      code: `
function listen(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}
listen(() => {});
      `,
      errors: [{ messageId: 'floatingCleanup', line: 6 }],
    },
    {
      name: 'arrow function variable returning a cleanup function',
      code: `
const watch = (cb: () => void) => () => cb();
watch(() => {});
      `,
      errors: [{ messageId: 'floatingCleanup', line: 3 }],
    },
    {
      name: 'awaited async function resolving to a cleanup function',
      code: `
declare function connect(): Promise<() => void>;
async function f() {
  await connect();
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 4 }],
    },
    {
      name: 'method of a class instance returning a cleanup function',
      code: `
class Store {
  subscribe(cb: () => void) {
    return () => cb();
  }
}
const store = new Store();
store.subscribe(() => {});
      `,
      errors: [{ messageId: 'floatingCleanup', line: 8 }],
    },
    {
      name: 'optional call returning a cleanup function',
      code: `
type Unsubscribe = () => void;
declare const store: { subscribe(cb: () => void): Unsubscribe };
store?.subscribe(() => {});
      `,
      errors: [{ messageId: 'floatingCleanup', line: 4 }],
    },
    {
      name: 'function listed in cleanupFunctions',
      code: `
import { onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(() => {});
      `,
      options: [{ cleanupFunctions: ['onAuthStateChanged'] }],
      errors: [{ messageId: 'floatingCleanup', line: 3 }],
    },
    {
      name: 'discarded unsubscribe function',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
function f() {
  subscribe(() => {});
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 5 }],
    },
    {
      name: 'call returning a fresh callable (not `this`)',
      code: `
interface Scale {
  (value: number): number;
  copy(): Scale;
}
declare const scale: Scale;
function f() {
  scale.copy();
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 8 }],
    },
    {
      name: 'discarded cleanup behind a unary operator',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
function f() {
  !subscribe(() => {});
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 5 }],
    },
    {
      name: 'discarded cleanup in a logical expression',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
declare const enabled: boolean;
function f() {
  enabled && subscribe(() => {});
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 6 }],
    },
    {
      name: 'discarded cleanup in a conditional expression',
      code: `
type Unsubscribe = () => void;
declare function subscribe(cb: () => void): Unsubscribe;
declare const enabled: boolean;
function f() {
  enabled ? subscribe(() => {}) : undefined;
}
      `,
      errors: [{ messageId: 'floatingCleanup', line: 6 }],
    },
  ],
});
