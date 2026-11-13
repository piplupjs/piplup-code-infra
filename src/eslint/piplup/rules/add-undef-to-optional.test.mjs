import TSESlintParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

import rule from './add-undef-to-optional.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: TSESlintParser,
  },
});

ruleTester.run('add-undef-to-optional', rule, {
  invalid: [
    {
      code: `export type Hello = {
  name?: string | number;
};
    `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property without undefined',
      output: `export type Hello = {
  name?: (string | number) | undefined;
};
    `,
    },
    {
      code: `export type Hello = {
  name?: string;
};
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with simple type',
      output: `export type Hello = {
  name?: (string) | undefined;
};
      `,
    },
    {
      code: `type NameArg = string | number;
export type Hello = {
  name?: NameArg;
};
      `,
      errors: [{ column: 3, line: 3, messageId: 'addUndefined' }],
      name: 'optional property with local type reference without undefined',
      output: `type NameArg = string | number;
export type Hello = {
  name?: (NameArg) | undefined;
};
      `,
    },
    {
      code: `export interface Hello {
  name?: string;
}
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property in interface without undefined',
      output: `export interface Hello {
  name?: (string) | undefined;
}
      `,
    },
    {
      code: `export type Hello = {
  name?: string;
  age?: number;
};
      `,
      errors: [
        { column: 3, line: 2, messageId: 'addUndefined' },
        { column: 3, line: 3, messageId: 'addUndefined' },
      ],
      name: 'multiple optional properties missing undefined',
      output: `export type Hello = {
  name?: (string) | undefined;
  age?: (number) | undefined;
};
      `,
    },
    {
      code: `export type Hello = {
  value?: string | number | boolean;
};
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with union but no undefined',
      output: `export type Hello = {
  value?: (string | number | boolean) | undefined;
};
      `,
    },
    {
      code: `type Inner = string | number;
type Outer = Inner | boolean;
export type Hello = {
  value?: Outer;
};
      `,
      errors: [{ column: 3, line: 4, messageId: 'addUndefined' }],
      name: 'optional property with nested type reference without undefined',
      output: `type Inner = string | number;
type Outer = Inner | boolean;
export type Hello = {
  value?: (Outer) | undefined;
};
      `,
    },
    {
      code: `export type Hello = {
  value?: string | null;
};
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with null but no undefined',
      output: `export type Hello = {
  value?: (string | null) | undefined;
};
      `,
    },
    {
      code: `import { SomeType } from './other';
export type Hello = {
  name?: SomeType;
};
      `,
      errors: [{ column: 3, line: 3, messageId: 'addUndefined' }],
      name: 'optional property with imported type reference',
      output: `import { SomeType } from './other';
export type Hello = {
  name?: (SomeType) | undefined;
};
      `,
    },
    {
      code: `export type Hello = {
  data?: Record<string, string>;
};
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with built-in type reference',
      output: `export type Hello = {
  data?: (Record<string, string>) | undefined;
};
      `,
    },
    {
      code: `export type Hello<T> = {
  value?: T;
};
      `,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with generic type parameter',
      output: `export type Hello<T> = {
  value?: (T) | undefined;
};
      `,
    },
    {
      code: `export type Hello = {
  onPressedChange?: (pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void;
}`,
      errors: [{ column: 3, line: 2, messageId: 'addUndefined' }],
      name: 'optional property with function type without undefined',
      output: `export type Hello = {
  onPressedChange?: ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
}`,
    },
  ],
  valid: [
    {
      code: `
    export type Hello = {
      name?: string | undefined;
    };
        `,
      name: 'optional property with undefined',
    },
    {
      code: `
    export type Hello = {
      name?: (string | number) | undefined;
    };
        `,
      name: 'optional property with undefined in union',
    },
    {
      code: `
    type NameArg = string | number;
    export type Hello = {
      name?: NameArg | undefined;
    };
        `,
      name: 'optional property with undefined and type reference',
    },
    {
      code: `
    type NameArg = string | number | undefined;
    export type Hello = {
      name?: NameArg;
    };
        `,
      name: 'optional property with type reference including undefined',
    },
    {
      code: `
    export type Hello = {
      data?: Record<string, string> | undefined;
    };
        `,
      name: 'optional property with built-in type reference and explicit undefined',
    },
    {
      code: `
    export type Hello<T> = {
      value?: T | undefined;
    };
        `,
      name: 'optional property with generic type reference and explicit undefined',
    },
    {
      code: `
    export type Hello = {
      name: string | number;
    };
        `,
      name: 'required property without undefined',
    },
    {
      code: `
    export type Hello = {
      name?: string | null | undefined;
    };
        `,
      name: 'optional property with null and undefined',
    },
    {
      code: `
    export type Hello = {
      name?: (string | number | boolean) | undefined;
    };
        `,
      name: 'optional property with complex union including undefined',
    },
    {
      code: `
    type Inner = string | undefined;
    type Outer = Inner | number;
    export type Hello = {
      name?: Outer;
    };
        `,
      name: 'optional property with nested type reference including undefined',
    },
    {
      code: `
    type NameArg = string | undefined;
    export interface Hello {
      name?: NameArg;
    }
        `,
      name: 'optional property with type reference in interface',
    },
    {
      code: `
    type WithUndef = string | undefined;
    type WithoutUndef = string | number;
    export type Hello = {
      a?: WithUndef;
      b?: WithoutUndef | undefined;
      c?: string | undefined;
    };
        `,
      name: 'multiple optional properties with mixed scenarios',
    },
    {
      code: `
    export type Hello = {
      value?: any;
    };
        `,
      name: 'optional property with any type',
    },
    {
      code: `
    export type Hello = {
      value?: unknown;
    };
        `,
      name: 'optional property with unknown type',
    },
    {
      code: `
    export type Hello = {
      value?: string | any;
    };
        `,
      name: 'optional property with any in union',
    },
    {
      code: `
    export type Hello = {
      value?: string | unknown;
    };
        `,
      name: 'optional property with unknown in union',
    },
    {
      code: `
    type AnyType = any;
    export type Hello = {
      value?: AnyType;
    };
        `,
      name: 'optional property with type reference to any',
    },
    {
      code: `
    type UnknownType = unknown;
    export type Hello = {
      value?: UnknownType;
    };
        `,
      name: 'optional property with type reference to unknown',
    },
    {
      code: `
    import { ReactNode } from 'react';
    export type Hello = {
      children?: ReactNode;
    };
        `,
      name: 'optional property with ReactNode',
    },
    {
      code: `
    import React from 'react';
    export type Hello = {
      children?: React.ReactNode;
    };
        `,
      name: 'optional property with React.ReactNode',
    },
    {
      code: `
    export type Hello = {
      content?: ReactNode;
    };
        `,
      name: 'optional property with ReactNode without import',
    },
    {
      code: `
    import React from 'react';
    export type Hello = {
      value?: string | React.ReactNode;
    };
        `,
      name: 'optional property with React.ReactNode in union',
    },
  ],
});
