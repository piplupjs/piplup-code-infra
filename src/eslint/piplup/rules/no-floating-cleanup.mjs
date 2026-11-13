/**
 * no-floating-cleanup
 *
 * Like `@typescript-eslint/no-floating-promises`, but for functions: reports
 * call expressions used as statements whose return value is a function
 * (e.g. an `unsubscribe` / cleanup callback). Ignoring such a value usually
 * means the subscription can never be torn down — a leak.
 *
 * The rule needs no type information, so it runs the same under ESLint and
 * oxlint. It works out what a call returns from what the file itself declares:
 * - functions, `declare function`s and function-valued variables, from their
 *   return type annotation or, without one, from what their body returns;
 * - methods of a variable whose type annotation names an interface, type
 *   literal or class declared in the file (or which is created with `new` from
 *   such a class);
 * - type aliases and interfaces with call signatures, followed through unions
 *   and `Promise<...>` when the call is awaited.
 *
 * Calls it can't resolve in the file, such as imported functions, are not
 * reported. List those with the `cleanupFunctions` option, matched against the
 * called function's name or the called method's property name.
 *
 * Calls that return `this` are never reported: fluent / builder APIs (e.g. d3
 * scales) chain by returning `this`, so the discarded result is callable but
 * not a leaked cleanup function.
 *
 * Opt-out at a call site, same convention as no-floating-promises:
 *   void subscribe(cb);
 */

/** @typedef {{ type: string, [key: string]: any }} AnyNode */
/** @typedef {{ kind: 'cleanup', name: string } | { kind: 'this' } | { kind: 'other' }} ReturnKind */

/** @type {ReturnKind} */
const OTHER = { kind: 'other' };
/** @type {ReturnKind} */
const THIS = { kind: 'this' };

const FUNCTION_NODES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'TSDeclareFunction',
]);

/**
 * @param {string} name
 * @returns {ReturnKind}
 */
function cleanup(name) {
  return { kind: 'cleanup', name };
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow ignoring returned cleanup/unsubscribe functions, which leaks subscriptions.',
      url: 'https://github.com/piplupjs/piplup-code-infra/blob/main/src/eslint/piplup/rules/no-floating-cleanup.mjs',
    },
    messages: {
      floatingCleanup:
        "Return value of type '{{typeName}}' is ignored. This likely leaks a subscription — " +
        'store the cleanup function, or discard it explicitly with the `void` operator.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          cleanupFunctions: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { cleanupFunctions = [] } = context.options[0] ?? {};
    const knownCleanupFunctions = new Set(cleanupFunctions);
    const { sourceCode } = context;

    /**
     * Every declaration in the file, by name. Shadowing isn't modelled: a name
     * declared more than once only counts when all its declarations agree.
     * @type {Map<string, AnyNode[]>}
     */
    const declarations = new Map();
    /** @type {AnyNode[]} */
    const statements = [];

    /**
     * @param {string} name
     * @param {AnyNode} node
     */
    function declare(name, node) {
      const existing = declarations.get(name);
      if (existing) {
        existing.push(node);
      } else {
        declarations.set(name, [node]);
      }
    }

    /**
     * @param {string} name
     * @param {(node: AnyNode) => boolean} predicate
     * @returns {AnyNode[]}
     */
    function lookup(name, predicate) {
      return (declarations.get(name) ?? []).filter(predicate);
    }

    /**
     * Combines the kinds of several declarations of one name, or several
     * `return`s of one function: a cleanup only when every one is.
     * @param {ReturnKind[]} kinds
     * @returns {ReturnKind}
     */
    function every(kinds) {
      if (kinds.length === 0) {
        return OTHER;
      }
      if (kinds.every((kind) => kind.kind === 'this')) {
        return THIS;
      }
      return kinds.every((kind) => kind.kind === 'cleanup') ? kinds[0] : OTHER;
    }

    /**
     * @param {AnyNode} node
     * @returns {string}
     */
    function textOf(node) {
      return sourceCode.getText(/** @type {any} */ (node));
    }

    /**
     * Does a type literal / interface body have a call signature?
     * @param {AnyNode[]} members
     * @returns {boolean}
     */
    function hasCallSignature(members) {
      return members.some((member) => member.type === 'TSCallSignatureDeclaration');
    }

    /**
     * What does a value of this type look like when it's the result of a call?
     * @param {AnyNode | null | undefined} type
     * @param {{ awaited?: boolean, seen?: Set<string> }} [options]
     * @returns {ReturnKind}
     */
    function kindOfType(type, { awaited = false, seen = new Set() } = {}) {
      if (!type) {
        return OTHER;
      }
      switch (type.type) {
        case 'TSFunctionType':
        case 'TSConstructorType':
          return cleanup(textOf(type));
        case 'TSThisType':
          return THIS;
        case 'TSParenthesizedType':
          return kindOfType(type.typeAnnotation, { awaited, seen });
        case 'TSUnionType': {
          // Any callable member may be the returned cleanup function.
          const callable = type.types
            .map((/** @type {AnyNode} */ member) => kindOfType(member, { awaited, seen }))
            .find((/** @type {ReturnKind} */ kind) => kind.kind === 'cleanup');
          return callable ? cleanup(textOf(type)) : OTHER;
        }
        case 'TSTypeLiteral':
          return hasCallSignature(type.members) ? cleanup(textOf(type)) : OTHER;
        case 'TSTypeReference': {
          if (type.typeName.type !== 'Identifier') {
            return OTHER;
          }
          const { name } = type.typeName;
          if (name === 'Promise' || name === 'PromiseLike') {
            const args = (type.typeArguments ?? type.typeParameters)?.params;
            return awaited && args?.length ? kindOfType(args[0], { seen }) : OTHER;
          }
          if (seen.has(name)) {
            return OTHER;
          }
          const nextSeen = new Set(seen).add(name);
          const targets = lookup(
            name,
            (node) =>
              node.type === 'TSTypeAliasDeclaration' || node.type === 'TSInterfaceDeclaration',
          );
          const kind = every(
            targets.map((target) => {
              if (target.type === 'TSTypeAliasDeclaration') {
                return kindOfType(target.typeAnnotation, { awaited, seen: nextSeen });
              }
              return hasCallSignature(target.body.body) ? cleanup(name) : OTHER;
            }),
          );
          return kind.kind === 'cleanup' ? cleanup(name) : kind;
        }
        default:
          return OTHER;
      }
    }

    /**
     * The `return` statements of a function body, not counting nested functions.
     * @param {AnyNode} node
     * @param {AnyNode[]} [out]
     * @returns {AnyNode[]}
     */
    function returnStatements(node, out = []) {
      if (node.type === 'ReturnStatement') {
        out.push(node);
        return out;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent') {
          continue;
        }
        const child = node[key];
        const children = Array.isArray(child) ? child : [child];
        for (const item of children) {
          if (item && typeof item.type === 'string' && !FUNCTION_NODES.has(item.type)) {
            returnStatements(item, out);
          }
        }
      }
      return out;
    }

    /**
     * @param {AnyNode | null | undefined} expression
     * @returns {ReturnKind}
     */
    function kindOfReturnedExpression(expression) {
      if (!expression) {
        return OTHER;
      }
      switch (expression.type) {
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return cleanup('function');
        case 'ThisExpression':
          return THIS;
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          return kindOfReturnedExpression(expression.expression);
        default:
          return OTHER;
      }
    }

    /**
     * What does calling this function return?
     * @param {AnyNode} fn a function node, method signature or function type
     * @param {boolean} awaited
     * @returns {ReturnKind}
     */
    function kindOfFunctionResult(fn, awaited) {
      const annotation = fn.returnType?.typeAnnotation;
      if (annotation) {
        return kindOfType(annotation, { awaited });
      }
      if (fn.async && !awaited) {
        // An un-awaited async call yields a promise; no-floating-promises' job.
        return OTHER;
      }
      if (fn.type === 'ArrowFunctionExpression' && fn.expression) {
        return kindOfReturnedExpression(fn.body);
      }
      if (!fn.body) {
        return OTHER;
      }
      return every(returnStatements(fn.body).map((ret) => kindOfReturnedExpression(ret.argument)));
    }

    /**
     * The members of the type a variable holds, when the file declares it.
     * @param {string} name
     * @returns {AnyNode[]}
     */
    function membersOfVariable(name) {
      const variables = lookup(name, (node) => node.type === 'VariableDeclarator');
      if (variables.length !== 1) {
        return [];
      }
      const [variable] = variables;
      /** @type {string | undefined} */
      let typeName;
      const annotation = variable.id.typeAnnotation?.typeAnnotation;
      if (annotation?.type === 'TSTypeLiteral') {
        return annotation.members;
      }
      if (annotation?.type === 'TSTypeReference' && annotation.typeName.type === 'Identifier') {
        typeName = annotation.typeName.name;
      } else if (
        !annotation &&
        variable.init?.type === 'NewExpression' &&
        variable.init.callee.type === 'Identifier'
      ) {
        typeName = variable.init.callee.name;
      }
      if (!typeName) {
        return [];
      }
      return lookup(typeName, (node) =>
        ['TSInterfaceDeclaration', 'ClassDeclaration', 'TSTypeAliasDeclaration'].includes(
          node.type,
        ),
      ).flatMap((node) => {
        if (node.type === 'TSTypeAliasDeclaration') {
          return node.typeAnnotation.type === 'TSTypeLiteral' ? node.typeAnnotation.members : [];
        }
        return node.body.body;
      });
    }

    /**
     * @param {AnyNode} member an interface, type literal or class member
     * @param {boolean} awaited
     * @returns {ReturnKind}
     */
    function kindOfMemberCall(member, awaited) {
      switch (member.type) {
        case 'TSMethodSignature':
          return kindOfFunctionResult(member, awaited);
        case 'TSPropertySignature': {
          const type = member.typeAnnotation?.typeAnnotation;
          return type?.type === 'TSFunctionType' ? kindOfFunctionResult(type, awaited) : OTHER;
        }
        case 'MethodDefinition':
        case 'TSAbstractMethodDefinition':
          return kindOfFunctionResult(member.value, awaited);
        case 'PropertyDefinition':
          return member.value && FUNCTION_NODES.has(member.value.type)
            ? kindOfFunctionResult(member.value, awaited)
            : OTHER;
        default:
          return OTHER;
      }
    }

    /**
     * What does calling `object.property(...)` return?
     * @param {AnyNode} callee a non-computed MemberExpression
     * @param {boolean} awaited
     * @returns {ReturnKind}
     */
    function kindOfMethodCall(callee, awaited) {
      if (callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier') {
        return OTHER;
      }
      const property = callee.property.name;
      return every(
        membersOfVariable(callee.object.name)
          .filter((member) => !member.computed && member.key?.name === property)
          .map((member) => kindOfMemberCall(member, awaited)),
      );
    }

    /**
     * What does calling a function declared under this name return?
     * @param {string} name
     * @param {boolean} awaited
     * @returns {ReturnKind}
     */
    function kindOfNamedCall(name, awaited) {
      const kinds = lookup(
        name,
        (node) =>
          node.type === 'FunctionDeclaration' ||
          node.type === 'TSDeclareFunction' ||
          node.type === 'VariableDeclarator',
      ).map((node) => {
        if (node.type !== 'VariableDeclarator') {
          return kindOfFunctionResult(node, awaited);
        }
        if (node.init && FUNCTION_NODES.has(node.init.type)) {
          return kindOfFunctionResult(node.init, awaited);
        }
        const annotation = node.id.typeAnnotation?.typeAnnotation;
        if (annotation?.type === 'TSFunctionType') {
          return kindOfFunctionResult(annotation, awaited);
        }
        return OTHER;
      });
      return every(kinds);
    }

    /**
     * What does this discarded call (or awaited call) return?
     * @param {AnyNode} node
     * @returns {ReturnKind}
     */
    function kindOfCall(node) {
      let call = node;
      let awaited = false;
      if (call.type === 'AwaitExpression') {
        awaited = true;
        call = call.argument;
      }
      if (call.type === 'ChainExpression') {
        call = call.expression;
      }
      if (call.type !== 'CallExpression') {
        return OTHER;
      }
      const { callee } = call;
      if (callee.type === 'Identifier') {
        if (knownCleanupFunctions.has(callee.name)) {
          return cleanup(callee.name);
        }
        return kindOfNamedCall(callee.name, awaited);
      }
      if (callee.type === 'MemberExpression' && !callee.computed) {
        if (
          callee.property.type === 'Identifier' &&
          knownCleanupFunctions.has(callee.property.name)
        ) {
          return cleanup(callee.property.name);
        }
        return kindOfMethodCall(callee, awaited);
      }
      return OTHER;
    }

    /**
     * Unwrap an expression-statement expression down to the calls whose
     * results are being discarded. Mirrors the cases no-floating-promises
     * handles: plain calls, optional chains, `await`, comma sequences,
     * and the operand(s) of unary / logical / conditional expressions.
     * A top-level `void` operator is the explicit opt-out, so we stop there.
     * @param {AnyNode} expr
     * @param {AnyNode[]} [out]
     * @returns {AnyNode[]}
     */
    function findDiscardedCalls(expr, out = []) {
      switch (expr.type) {
        case 'CallExpression':
          out.push(expr);
          break;
        case 'ChainExpression':
          findDiscardedCalls(expr.expression, out);
          break;
        case 'AwaitExpression':
          if (expr.argument.type === 'CallExpression' || expr.argument.type === 'ChainExpression') {
            out.push(expr);
          }
          break;
        case 'UnaryExpression':
          // `void expr` is the explicit opt-out; any other unary operator
          // (e.g. `!subscribe()`) still discards the operand's result.
          if (expr.operator !== 'void') {
            findDiscardedCalls(expr.argument, out);
          }
          break;
        case 'LogicalExpression':
          // `a && subscribe()`, `a || subscribe()`, `a ?? subscribe()`:
          // either side may be the discarded value.
          findDiscardedCalls(expr.left, out);
          findDiscardedCalls(expr.right, out);
          break;
        case 'ConditionalExpression':
          // `cond ? subscribe() : other()`: the branches are discarded,
          // not the test.
          findDiscardedCalls(expr.consequent, out);
          findDiscardedCalls(expr.alternate, out);
          break;
        case 'SequenceExpression':
          // every value is discarded, the last one as the statement's value
          expr.expressions.forEach((/** @type {AnyNode} */ subExpr) =>
            findDiscardedCalls(subExpr, out),
          );
          break;
        default:
          break;
      }
      return out;
    }

    /** @type {Record<string, (node: any) => void>} */
    const visitors = {
      FunctionDeclaration(node) {
        if (node.id) {
          declare(node.id.name, node);
        }
      },
      TSDeclareFunction(node) {
        if (node.id) {
          declare(node.id.name, node);
        }
      },
      ClassDeclaration(node) {
        if (node.id) {
          declare(node.id.name, node);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          declare(node.id.name, node);
        }
      },
      TSTypeAliasDeclaration(node) {
        declare(node.id.name, node);
      },
      TSInterfaceDeclaration(node) {
        declare(node.id.name, node);
      },
      ExpressionStatement(node) {
        statements.push(node);
      },
      // Declarations may come after the calls that use them, so report once
      // the whole file has been seen.
      'Program:exit'() {
        for (const statement of statements) {
          for (const call of findDiscardedCalls(statement.expression)) {
            const kind = kindOfCall(call);
            if (kind.kind === 'cleanup') {
              context.report({
                node: call,
                messageId: 'floatingCleanup',
                data: { typeName: kind.name },
              });
            }
          }
        }
      },
    };
    return visitors;
  },
};
