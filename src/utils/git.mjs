import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { $ } from 'execa';
import gitUrlParse from 'git-url-parse';

/**
 * @typedef {Object} RepoInfo
 * @property {string} owner - Repository owner
 * @property {string} repo - Repository name
 * @property {string} remoteName - Remote name
 */

/**
 * The repository a remote URL points at, if it is a GitHub repository.
 * @param {string} url
 * @returns {{ owner: string, repo: string } | null}
 */
function githubRepositoryOf(url) {
  try {
    const parsed = gitUrlParse(url);
    return parsed.source === 'github.com' && parsed.owner && parsed.name
      ? { owner: parsed.owner, repo: parsed.name }
      : null;
  } catch {
    // Not a URL git-url-parse understands, such as a local path: not a GitHub repository either.
    return null;
  }
}

/**
 * The GitHub owner named by the `repository` field of the repository's root package.json, which
 * marks the canonical repository as opposed to a fork. `null` when it names none.
 * @param {string} cwd
 * @returns {Promise<string | null>}
 */
async function getCanonicalOwner(cwd) {
  const { stdout: root } = await $({ cwd, reject: false })`git rev-parse --show-toplevel`;
  if (!root.trim()) {
    return null;
  }
  let repository;
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(root.trim(), 'package.json'), 'utf8'),
    );
    repository = packageJson.repository;
  } catch {
    return null;
  }
  const url = typeof repository === 'string' ? repository : repository?.url;
  if (typeof url !== 'string') {
    return null;
  }
  // npm's shorthands: `owner/repo` and `github:owner/repo`.
  const shorthand = /^(?:github:)?([\w.-]+)\/[\w.-]+$/.exec(url);
  if (shorthand) {
    return shorthand[1];
  }
  return githubRepositoryOf(url.replace(/^git\+/, ''))?.owner ?? null;
}

/**
 * The canonical repository's remote, as opposed to a fork's: `upstream`, else `origin`, each only if
 * it points at a GitHub repository owned by the owner the root package.json's `repository` field
 * names (any owner when it names none). Reads the configured URLs, which `insteadOf` does not
 * rewrite.
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<RepoInfo>}
 */
export async function getRepositoryInfo(cwd = process.cwd()) {
  // Exits 1 when neither remote is configured; the error below reports that.
  const { stdout } = await $({
    cwd,
    reject: false,
  })`git config --get-regexp ${'^remote\\.(upstream|origin)\\.url$'}`;
  /** @type {Map<string, string>} */
  const urls = new Map();
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [key, url] = line.split(' ', 2);
    urls.set(key.slice('remote.'.length, -'.url'.length), url);
  }

  const canonicalOwner = await getCanonicalOwner(cwd);
  for (const remoteName of ['upstream', 'origin']) {
    const url = urls.get(remoteName);
    const repository = url ? githubRepositoryOf(url) : null;
    if (
      repository &&
      (!canonicalOwner || repository.owner.toLowerCase() === canonicalOwner.toLowerCase())
    ) {
      return { ...repository, remoteName };
    }
  }

  const found = [...urls].map(([name, url]) => `${name}: ${url}`).join(', ') || 'none';
  throw new Error(
    `No canonical remote: neither \`upstream\` nor \`origin\` points at a GitHub repository${canonicalOwner ? ` of ${canonicalOwner}` : ''} (${found}). ` +
      'Add an `upstream` remote for it, or name the remote explicitly where the command allows it.',
  );
}

/**
 * Get current git SHA
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<string>} Current git commit SHA
 */
export async function getCurrentGitSha(cwd = process.cwd()) {
  const result = await $({ cwd })`git rev-parse HEAD`;
  return result.stdout.trim();
}

/**
 * Check whether a tag already exists on the origin remote
 * @param {string} tagName - Tag name to check (e.g. `v1.2.3`)
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<boolean>} True if the tag exists on origin
 */
export async function remoteGitTagExists(tagName, cwd = process.cwd()) {
  const { stdout } = await $({ cwd })`git ls-remote --tags origin refs/tags/${tagName}`;
  return stdout.trim().length > 0;
}

/**
 * The default branch of `remote`, as the remote itself reports it.
 * @param {string} remote
 * @param {string} cwd
 * @returns {Promise<string>}
 */
async function getDefaultBranchOf(remote, cwd) {
  const { stdout } = await $({ cwd })`git ls-remote --symref ${remote} HEAD`;
  const match = /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(stdout);
  if (!match) {
    throw new Error(`Remote "${remote}" does not report a default branch.`);
  }
  return match[1];
}

/**
 * The commit HEAD should be compared against: where it forked from the base branch, or its parent
 * when HEAD is already on the base branch.
 * @param {Object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.remote] - Defaults to the canonical remote.
 * @param {string} [options.baseBranch] - Defaults to the remote's default branch.
 * @returns {Promise<string>}
 */
export async function resolveBaseline(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const remote = options.remote ?? (await getRepositoryInfo(cwd)).remoteName;
  const baseBranch = options.baseBranch ?? (await getDefaultBranchOf(remote, cwd));

  await $({ cwd })`git fetch --no-tags ${remote} ${baseBranch}`;
  const [forkPoint, head] = await Promise.all([
    $({ cwd })`git merge-base HEAD FETCH_HEAD`.then((result) => result.stdout.trim()),
    getCurrentGitSha(cwd),
  ]);
  if (forkPoint !== head) {
    return forkPoint;
  }

  const parent = await $({ cwd, reject: false })`git rev-parse --verify HEAD~1`;
  if (parent.exitCode !== 0) {
    throw new Error(
      'HEAD has no parent commit to compare against. A shallow clone is the usual cause.',
    );
  }
  return parent.stdout.trim();
}

/**
 * The most recent version tag reachable from HEAD — where a changelog's range starts.
 * @param {Object} opts
 * @param {string} opts.cwd
 * @param {boolean} [opts.fetchAll=true] Whether to fetch all tags from all remotes before finding the latest tag.
 * @returns {Promise<string>}
 */
export async function findLatestTaggedVersion(opts) {
  const $$ = $({ cwd: opts.cwd });
  const fetchAll = opts.fetchAll ?? true;
  if (fetchAll) {
    // --force to update any existing tags that may have changed to avoid the clobering error.
    const { remoteName } = await getRepositoryInfo(opts.cwd);
    await $$`git fetch --tags --force ${remoteName}`;
  }
  const { stdout } = await $$`git describe --tags --abbrev=0 --match ${'v*'}`; // only include "version-tags"
  return stdout.trim();
}
