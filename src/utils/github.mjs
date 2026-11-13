/**
 * GitHub authentication for the CLI.
 *
 * Tokens come from the environment (`GITHUB_TOKEN`, then `GH_TOKEN`) or, on a developer machine,
 * from the GitHub CLI (`gh auth token`). Run `gh auth login` once to make the latter work.
 */

import { $ } from 'execa';

/** @type {Promise<string> | undefined} */
let cachedToken;

/**
 * @returns {Promise<string>} A GitHub token
 */
async function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) {
    return fromEnv;
  }
  const result = await $({ reject: false })`gh auth token`;
  const token = result.exitCode === 0 ? result.stdout.trim() : '';
  if (!token) {
    throw new Error(
      'No GitHub token found. Set GITHUB_TOKEN (or GH_TOKEN), or install the GitHub CLI and run `gh auth login`.',
    );
  }
  return token;
}

/**
 * @returns {Promise<string>} A GitHub token, resolved once per process
 */
export function getGitHubToken() {
  cachedToken ??= resolveToken();
  return cachedToken;
}

/**
 * Octokit `authStrategy` that authenticates every request with {@link getGitHubToken}.
 */
export function persistentAuthStrategy() {
  /**
   * @param {import('@octokit/types').RequestInterface} request
   * @param {import('@octokit/types').Route} route
   * @param {import('@octokit/types').RequestParameters} parameters
   */
  async function hook(request, route, parameters) {
    const token = await getGitHubToken();
    const endpoint = request.endpoint.merge(route, parameters);
    endpoint.headers.authorization = `token ${token}`;
    // @ts-expect-error - request.endpoint.merge doesn't return the right type
    return request(endpoint);
  }

  return { hook };
}

/**
 * Returns when a rate-limited request may be retried, or `null` for other errors.
 * https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
 *
 * @param {unknown} error
 * @returns {Date | null}
 */
export function getRateLimitRetryTime(error) {
  const { status, response, message } = /** @type {any} */ (error) ?? {};
  if (status !== 403 && status !== 429) {
    return null;
  }
  const headers = response?.headers ?? {};
  const now = Date.now();
  let retryTime;
  if (headers['retry-after']) {
    retryTime = now + Number(headers['retry-after']) * 1000;
  } else if (headers['x-ratelimit-remaining'] === '0' && headers['x-ratelimit-reset']) {
    retryTime = Number(headers['x-ratelimit-reset']) * 1000;
  } else if (/rate limit/i.test(message ?? '')) {
    retryTime = now;
  } else {
    return null;
  }
  return new Date(Math.max(retryTime, now + 60_000));
}
