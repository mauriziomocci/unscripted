import type { Rule } from 'eslint';

type VisitorKeys = Record<string, readonly string[] | undefined>;

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function isNode(value: unknown): value is Rule.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Whether a `throw` is reachable from `node` without entering a nested
 * function: a throw inside a callback runs later, so it does not rethrow the
 * error being handled.
 */
function containsThrow(node: Rule.Node, visitorKeys: VisitorKeys): boolean {
  if (node.type === 'ThrowStatement') return true;
  if (FUNCTION_TYPES.has(node.type)) return false;
  const record = node as unknown as Record<string, unknown>;
  return (visitorKeys[node.type] ?? []).some((key) => {
    const child = record[key];
    const children = Array.isArray(child) ? (child as unknown[]) : [child];
    return children.some((item) => isNode(item) && containsThrow(item, visitorKeys));
  });
}

function methodName(callee: Rule.Node): string | undefined {
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  return callee.property.type === 'Identifier' ? callee.property.name : undefined;
}

/**
 * Reports error handlers that do not rethrow (R-05, S-01): a `catch` clause
 * without a reachable `throw`, a `.catch(handler)` whose inline handler does not
 * rethrow, a `.catch(reference)` whose body cannot be checked, and a
 * two-argument `.then(ok, onRejected)`. A site that maps an error to a typed
 * result is allowed only with a written `taste-exempt:` reason.
 *
 * Limit: any reachable `throw` counts, so `if (flag) throw e; return null;`
 * passes. The rule catches handlers that never rethrow, not conditional
 * rethrows; review covers those.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      swallowedCatch: 'This catch never rethrows: the error is swallowed.',
      swallowedHandler: 'This .catch handler never rethrows: the error is swallowed.',
      opaqueHandler: 'Pass an inline function to .catch so its body can be checked.',
      rejectionInThen: 'Use .catch for the rejection instead of a second .then argument.',
    },
  },
  create(context) {
    const { visitorKeys } = context.sourceCode;
    return {
      CatchClause(node) {
        if (!containsThrow(node.body as Rule.Node, visitorKeys)) {
          context.report({ node, messageId: 'swallowedCatch' });
        }
      },
      CallExpression(node) {
        const name = methodName(node.callee as Rule.Node);
        const [handler] = node.arguments;
        if (name === 'then' && node.arguments.length >= 2) {
          context.report({ node, messageId: 'rejectionInThen' });
        } else if (name === 'catch' && handler) {
          if (!FUNCTION_TYPES.has(handler.type)) {
            context.report({ node, messageId: 'opaqueHandler' });
          } else if (
            !containsThrow((handler as unknown as { body: Rule.Node }).body, visitorKeys)
          ) {
            context.report({ node, messageId: 'swallowedHandler' });
          }
        }
      },
    };
  },
};

export default rule;
