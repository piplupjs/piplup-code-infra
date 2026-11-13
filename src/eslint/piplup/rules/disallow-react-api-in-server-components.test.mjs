import parser from '@typescript-eslint/parser';
import eslint from 'eslint';

import rule from './disallow-react-api-in-server-components.mjs';

const ruleTester = new eslint.RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('disallow-react-api-in-server-components', rule, {
  invalid: [
    // React.* API calls without 'use client' directive
    {
      code: `/* license header */
React.useState();`,
      errors: [
        {
          message:
            "Using 'React.useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'inserts use client after leading comments',
      output: `/* license header */
'use client';
React.useState();`,
    },
    {
      code: `React.useState();`,
      errors: [
        {
          message:
            "Using 'React.useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useState without use client directive',
      output: `'use client';
React.useState();`,
    },
    {
      code: `React.useEffect(() => {});`,
      errors: [
        {
          message:
            "Using 'React.useEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useEffect without use client directive',
      output: `'use client';
React.useEffect(() => {});`,
    },
    {
      code: `React.useContext(MyContext);`,
      errors: [
        {
          message:
            "Using 'React.useContext' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useContext without use client directive',
      output: `'use client';
React.useContext(MyContext);`,
    },
    {
      code: `React.useRef();`,
      errors: [
        {
          message:
            "Using 'React.useRef' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useRef without use client directive',
      output: `'use client';
React.useRef();`,
    },
    {
      code: `React.useLayoutEffect(() => {});`,
      errors: [
        {
          message:
            "Using 'React.useLayoutEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useLayoutEffect without use client directive',
      output: `'use client';
React.useLayoutEffect(() => {});`,
    },
    {
      code: `React.useReducer(reducer, initialState);`,
      errors: [
        {
          message:
            "Using 'React.useReducer' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useReducer without use client directive',
      output: `'use client';
React.useReducer(reducer, initialState);`,
    },
    {
      code: `React.useTransition();`,
      errors: [
        {
          message:
            "Using 'React.useTransition' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useTransition without use client directive',
      output: `'use client';
React.useTransition();`,
    },
    {
      code: `React.createContext();`,
      errors: [
        {
          message:
            "Using 'React.createContext' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.createContext without use client directive',
      output: `'use client';
React.createContext();`,
    },
    // Named imports from 'react' without 'use client' directive
    {
      code: `import { useState } from 'react';`,
      errors: [
        {
          message:
            "Using 'useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useState without use client directive',
      output: `'use client';
import { useState } from 'react';`,
    },
    {
      code: `import { useContext } from 'react';`,
      errors: [
        {
          message:
            "Using 'useContext' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useContext without use client directive',
      output: `'use client';
import { useContext } from 'react';`,
    },
    {
      code: `import { useRef } from 'react';`,
      errors: [
        {
          message: "Using 'useRef' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useRef without use client directive',
      output: `'use client';
import { useRef } from 'react';`,
    },
    {
      code: `import { useState, useEffect } from 'react';`,
      errors: [
        {
          message:
            "Using 'useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
        {
          message:
            "Using 'useEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import multiple React APIs without use client directive',
      output: `'use client';
import { useState, useEffect } from 'react';`,
    },
    // Forbidden APIs (useIsoLayoutEffect)
    {
      code: `import { useIsoLayoutEffect } from '@piplup/utils';`,
      errors: [
        {
          message:
            "Using 'useIsoLayoutEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useIsoLayoutEffect without use client directive',
      output: `'use client';
import { useIsoLayoutEffect } from '@piplup/utils';`,
    },
    {
      code: `import useIsoLayoutEffect from '@piplup/utils/useIsoLayoutEffect';`,
      errors: [
        {
          message:
            "Using 'useIsoLayoutEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useIsoLayoutEffect as default without use client directive',
      output: `'use client';
import useIsoLayoutEffect from '@piplup/utils/useIsoLayoutEffect';`,
    },
    {
      code: `useIsoLayoutEffect(() => {});`,
      errors: [
        {
          message:
            "Using 'useIsoLayoutEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'useIsoLayoutEffect call without use client directive',
      output: `'use client';
useIsoLayoutEffect(() => {});`,
    },
    // No autofix for 'use server' files
    {
      code: `'use server';
React.useState();`,
      errors: [
        {
          message:
            "Using 'React.useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'React.useState in use server file (no autofix)',
      output: null,
    },
    {
      code: `'use server';
import { useState } from 'react';`,
      errors: [
        {
          message:
            "Using 'useState' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useState in use server file (no autofix)',
      output: null,
    },
    {
      code: `'use server';
import { useIsoLayoutEffect } from '@piplup/utils';`,
      errors: [
        {
          message:
            "Using 'useIsoLayoutEffect' is forbidden if the file doesn't have a 'use client' directive.",
        },
      ],
      name: 'import useIsoLayoutEffect in use server file (no autofix)',
      output: null,
    },
  ],
  valid: [
    // Files with 'use client' directive are allowed to use React APIs
    {
      code: `'use client';
React.useState();`,
      name: 'React.useState with use client directive',
    },
    {
      code: `'use client';
React.useEffect(() => {});`,
      name: 'React.useEffect with use client directive',
    },
    {
      code: `'use client';
React.useContext(MyContext);`,
      name: 'React.useContext with use client directive',
    },
    {
      code: `'use client';
React.useRef();`,
      name: 'React.useRef with use client directive',
    },
    {
      code: `'use client';
import { useState } from 'react';`,
      name: 'import useState with use client directive',
    },
    {
      code: `'use client';
import { useContext } from 'react';`,
      name: 'import useContext with use client directive',
    },
    {
      code: `'use client';
import { useRef } from 'react';`,
      name: 'import useRef with use client directive',
    },
    {
      code: `'use client';
import { useIsoLayoutEffect } from '@piplup/utils';`,
      name: 'import useIsoLayoutEffect with use client directive',
    },
    {
      code: `'use client';
useIsoLayoutEffect(() => {});`,
      name: 'useIsoLayoutEffect call with use client directive',
    },
    // APIs not in the forbidden list are allowed
    {
      code: `React.memo(() => {});`,
      name: 'React.memo is allowed',
    },
    {
      code: `React.forwardRef(() => {});`,
      name: 'React.forwardRef is allowed',
    },
    {
      code: `import { useMemo } from 'react';`,
      name: 'import useMemo is allowed',
    },
    {
      code: `import { useCustomHook } from './hooks';`,
      name: 'custom hook is allowed',
    },
  ],
});
