const restrictedMethods = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'];

const restrictedSyntaxRules = restrictedMethods.map((method) => ({
  message: `Use global ${method} instead of window.${method}.`,
  selector: `MemberExpression[object.name='window'][property.name='${method}']`,
}));

/**
 * Core ESLint rules, and the piplup rules that apply to any JavaScript.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const rules = {
  'array-callback-return': ['error', { allowImplicit: true }],
  // Stylistic opinion
  'arrow-body-style': 'off',
  'consistent-return': 'error',
  'consistent-this': ['error', 'self'],
  curly: ['error', 'all'],
  // Additional best practices
  'default-case': ['error', { commentPattern: '^no default$' }],
  'default-case-last': 'error',
  'dot-notation': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  // Airbnb use warn https://github.com/airbnb/javascript/blob/63098cbb6c05376dbefc9a91351f5727540c1ce1/packages/eslint-config-airbnb-base/rules/style.js#L97
  // but eslint recommands error
  'func-names': 'error',
  // require all requires be top-level
  // https://eslint.org/docs/rules/global-require
  'global-require': 'error',
  // 'no-param-reassign': ['error', { props: true }],
  'guard-for-in': 'error',
  // Prevent the use of `e` as a shorthand for `event`, `error`, etc.
  'id-denylist': ['error', 'e'],
  'lines-around-directive': 'off',
  // Styles
  // require or disallow an empty line between class members
  // https://eslint.org/docs/rules/lines-between-class-members
  'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
  // Just as bad as "max components per file"
  'max-classes-per-file': 'off',
  // require a capital letter for constructors
  'new-cap': [
    'error',
    {
      capIsNew: false,
      capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
      newIsCap: true,
      newIsCapExceptions: [],
    },
  ],
  // Too interruptive
  'no-alert': 'error',
  // Disallow await inside of loops
  // https://eslint.org/docs/rules/no-await-in-loop
  'no-await-in-loop': 'error',
  // disallow use of bitwise operators
  // https://eslint.org/docs/rules/no-bitwise
  'no-bitwise': 'error',
  // disallow assignment in conditional expressions
  'no-cond-assign': ['error', 'always'],
  // Allow warn and error for dev environments
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-constant-condition': 'error',
  'no-continue': 'off',
  'no-else-return': ['error', { allowElseIf: false }],
  // Security & Best Practices
  'no-eval': 'error',
  'no-implied-eval': 'error',
  // disallow use of labels for anything other than loops and switches
  // https://eslint.org/docs/rules/no-labels
  'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
  // disallow unnecessary nested blocks
  // https://eslint.org/docs/rules/no-lone-blocks
  'no-lone-blocks': 'error',
  // disallow if as the only statement in an else block
  // https://eslint.org/docs/rules/no-lonely-if
  'no-lonely-if': 'error',
  'no-loss-of-precision': 'error',
  'no-multi-assign': 'error',
  'no-nested-ternary': 'error',
  // disallow use of new operator when not part of the assignment or comparison
  // https://eslint.org/docs/rules/no-new
  'no-new': 'error',
  // disallow use of new operator for Function object
  // https://eslint.org/docs/rules/no-new-func
  'no-new-func': 'error',
  'no-param-reassign': 'off', // It's fine.
  // disallow use of unary operators, ++ and --
  // https://eslint.org/docs/rules/no-plusplus
  'no-plusplus': 'error',
  // Disallow returning values from Promise executor functions
  // https://eslint.org/docs/rules/no-promise-executor-return
  'no-promise-executor-return': 'error',
  // disallow usage of __proto__ property
  // https://eslint.org/docs/rules/no-proto
  'no-proto': 'error',
  // Use the proptype inheritance chain
  'no-prototype-builtins': 'off',
  // We re-export default in many places, remove when https://github.com/airbnb/javascript/issues/2500 gets resolved
  'no-restricted-exports': 'off',
  'no-restricted-globals': ['error', 'isFinite', 'isNaN'],
  'no-restricted-syntax': [
    'error',
    {
      message:
        "Do not import default or named exports from React. Use a namespace import (import * as React from 'react';) instead.",
      selector:
        'ImportDeclaration[source.value="react"] ImportDefaultSpecifier, ImportDeclaration[source.value="react"] ImportSpecifier',
    },
    {
      message:
        "Do not import default or named exports from ReactDOM. Use a namespace import (import * as ReactDOM from 'react-dom';) instead.",
      selector:
        'ImportDeclaration[source.value="react-dom"] ImportDefaultSpecifier, ImportDeclaration[source.value="react-dom"] ImportSpecifier',
    },
    {
      message:
        "Do not import default or named exports from ReactDOM. Use a namespace import (import * as ReactDOM from 'react-dom/client';) instead.",
      selector:
        'ImportDeclaration[source.value="react-dom/client"] ImportDefaultSpecifier, ImportDeclaration[source.value="react-dom/client"] ImportSpecifier',
    },
    {
      message:
        "Do not import default or named exports from ReactDOMServer. Use a namespace import (import * as ReactDOM from 'react-dom/server';) instead.",
      selector:
        'ImportDeclaration[source.value="react-dom/server"] ImportDefaultSpecifier, ImportDeclaration[source.value="react-dom/server"] ImportSpecifier',
    },
    {
      message:
        "The 'use client' pragma can't be used with export * in the same module. This is not supported by Next.js.",
      selector: 'ExpressionStatement[expression.value="use client"] ~ ExportAllDeclaration',
    },
    {
      message: 'Do not call `Error(...)` without `new`. Use `new Error(...)` instead.',
      selector: "CallExpression[callee.name='Error']",
    },
    {
      // Inside HTML the <svg> element is already recognised by the browser, so the attribute
      // is dead weight.
      message:
        'Remove xmlns from inline <svg>. The attribute is redundant in HTML and adds unnecessary bytes.',
      selector: 'JSXOpeningElement[name.name="svg"] > JSXAttribute[name.name="xmlns"]',
    },
    ...restrictedSyntaxRules,
  ],
  // disallow use of assignment in return statement
  // https://eslint.org/docs/rules/no-return-assign
  'no-return-assign': ['error', 'always'],
  'no-script-url': 'error',
  // disallow comparisons where both sides are exactly the same
  // https://eslint.org/docs/rules/no-self-compare
  'no-self-compare': 'error',
  // Error
  // Disallow template literal placeholder syntax in regular strings
  // https://eslint.org/docs/rules/no-template-curly-in-string
  'no-template-curly-in-string': 'error',
  'no-throw-literal': 'error',
  'no-underscore-dangle': [
    'error',
    {
      allow: ['__filename', '__dirname'],
      allowAfterSuper: false,
      allowAfterThis: false,
      enforceInMethodNames: false,
    },
  ],
  'no-unneeded-ternary': ['error', { defaultAssignment: false }],
  // disallow useless string concatenation
  // https://eslint.org/docs/rules/no-useless-concat
  'no-useless-concat': 'error',
  // ES6+ Modern JavaScript
  'no-var': 'error',
  'object-shorthand': ['error', 'always'],
  'piplup/consistent-production-guard': 'error',
  'piplup/docgen-ignore-before-comment': 'error',
  // Opt-in: many React projects name component files in PascalCase.
  'piplup/filename-case': 'off',
  'piplup/flatten-parentheses': 'warn',
  'piplup/no-guarded-throw': 'error',
  'piplup/straight-quotes': 'off',
  'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
  'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
  // Destructuring harm grep potential.
  'prefer-destructuring': 'off',
  'prefer-template': 'error',
  radix: 'error',
  'spaced-comment': [
    'error',
    'always',
    {
      block: { balanced: true, exceptions: ['*'], markers: ['*'] },
      line: { exceptions: ['-', '+'], markers: ['/'] },
    },
  ],
  'vars-on-top': 'error',
};
