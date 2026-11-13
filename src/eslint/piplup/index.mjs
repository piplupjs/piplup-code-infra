import addUndefToOptional from './rules/add-undef-to-optional.mjs';
import consistentProductionGuard from './rules/consistent-production-guard.mjs';
import disallowActiveElementAsKeyEventTarget from './rules/disallow-active-element-as-key-event-target.mjs';
import disallowReactApiInServerComponents from './rules/disallow-react-api-in-server-components.mjs';
import docgenIgnoreBeforeComment from './rules/docgen-ignore-before-comment.mjs';
import filenameCase from './rules/filename-case.mjs';
import flattenParentheses from './rules/flatten-parentheses.mjs';
import noGuardedThrow from './rules/no-guarded-throw.mjs';
import noPresentationRole from './rules/no-presentation-role.mjs';
import noRestrictedResolvedImports from './rules/no-restricted-resolved-imports.mjs';
import requireDevWrapper from './rules/require-dev-wrapper.mjs';
import straightQuotes from './rules/straight-quotes.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const piplupPlugin = {
  meta: {
    name: '@piplup/eslint-plugin-piplup',
    version: '2.0.0',
  },
  rules: {
    'consistent-production-guard': consistentProductionGuard,
    'disallow-active-element-as-key-event-target': disallowActiveElementAsKeyEventTarget,
    'disallow-react-api-in-server-components': disallowReactApiInServerComponents,
    'docgen-ignore-before-comment': docgenIgnoreBeforeComment,
    'filename-case': filenameCase,
    'no-guarded-throw': noGuardedThrow,
    'no-presentation-role': noPresentationRole,
    'no-restricted-resolved-imports': noRestrictedResolvedImports,
    'require-dev-wrapper': requireDevWrapper,
    'straight-quotes': straightQuotes,
    // Some discrepancies between TypeScript and ESLint types - casting to any
    'add-undef-to-optional': /** @type {any} */ (addUndefToOptional),
    'flatten-parentheses': /** @type {any} */ (flattenParentheses),
  },
};

export default piplupPlugin;
