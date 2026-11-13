import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { execa } from 'execa';
import { describe, expect, it, onTestFinished } from 'vitest';

import { resolveBaseline } from './git.mjs';

// Keeps a contributor's own git config (signing, hooks) out of the fixture commits.
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

/** @param {string} prefix */
async function tempDir(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  onTestFinished(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

/** @param {string} cwd */
function gitIn(cwd) {
  return (/** @type {string[]} */ ...args) => execa('git', args, { cwd, env: GIT_ENV });
}

/**
 * A remote repository with `commits` on `main`, whose root package.json names `owner` as the
 * canonical repository's owner (no package.json when `owner` is `null`).
 * @param {string[]} [commits]
 * @param {{ owner?: string | null }} [options]
 */
async function makeRemote(commits = ['first', 'second', 'third'], { owner = 'piplupjs' } = {}) {
  const dir = await tempDir('baseline-remote-');
  const git = gitIn(dir);
  await git('init', '--initial-branch=main');
  if (owner) {
    // The root package.json names the canonical repository's owner.
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ repository: { type: 'git', url: `https://github.com/${owner}/repo.git` } }),
    );
    await git('add', 'package.json');
  }
  for (const message of commits) {
    // eslint-disable-next-line no-await-in-loop
    await git('commit', '--allow-empty', '-m', message);
  }
  const { stdout } = await git('log', '--format=%H', '--reverse');
  return { dir, git, shas: stdout.trim().split('\n') };
}

/**
 * Adds remote `name`, named by a GitHub URL under `owner` that `insteadOf` sends to the local
 * `dir`: the code under test sees the GitHub URL, while git fetches locally.
 * @param {(...args: string[]) => Promise<any>} git
 * @param {string} name
 * @param {string} owner
 * @param {string} dir
 * @param {'add' | 'set-url'} [verb]
 */
async function setRemote(git, name, owner, dir, verb = 'add') {
  const url = `https://github.com/${owner}/${path.basename(dir)}.git`;
  await git('remote', verb, name, url);
  await git('config', `url.${dir}.insteadOf`, url);
}

/**
 * Clones `remoteDir`, its `origin` named as a repository of `owner`.
 * @param {string} remoteDir
 * @param {{ owner?: string, cloneArgs?: string[] }} [options]
 */
async function clone(remoteDir, { owner = 'piplupjs', cloneArgs = [] } = {}) {
  const dir = await tempDir('baseline-clone-');
  await execa('git', ['clone', ...cloneArgs, remoteDir, dir], { env: GIT_ENV });
  const git = gitIn(dir);
  await setRemote(git, 'origin', owner, remoteDir, 'set-url');
  return { dir, git };
}

/**
 * A clone whose `origin` is a copy stuck at the first commit, by default someone's fork, with the
 * canonical repository added as `remoteName`, and a `feature` branch forked from its second commit.
 * @param {string} remoteName
 * @param {string} [originOwner]
 */
async function makeForkClone(remoteName, originOwner = 'someone') {
  const remote = await makeRemote();
  const fork = await clone(remote.dir);
  await fork.git('reset', '--hard', remote.shas[0]);
  const work = await clone(fork.dir, { owner: originOwner });
  await setRemote(work.git, remoteName, 'piplupjs', remote.dir);
  await work.git('fetch', remoteName);
  await work.git('checkout', '-b', 'feature', remote.shas[1]);
  await work.git('commit', '--allow-empty', '-m', 'work');
  return { remote, work };
}

describe('resolveBaseline', () => {
  it('uses the parent commit when HEAD is on the base branch', async () => {
    const remote = await makeRemote();
    const work = await clone(remote.dir);

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[1]);
  });

  it('uses the fork point when HEAD is on a branch', async () => {
    const remote = await makeRemote();
    const work = await clone(remote.dir);
    await work.git('checkout', '-b', 'feature', remote.shas[0]);
    await work.git('commit', '--allow-empty', '-m', 'work');

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[0]);
  });

  it('fetches the base branch a CI checkout does not have', async () => {
    const remote = await makeRemote();
    await remote.git('checkout', '-b', 'feature', remote.shas[0]);
    await remote.git('commit', '--allow-empty', '-m', 'work');
    await remote.git('checkout', 'main');
    const work = await clone(remote.dir, {
      cloneArgs: ['--single-branch', '--branch', 'feature'],
    });

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[0]);
  });

  it('measures from the base branch it is given', async () => {
    const remote = await makeRemote();
    await remote.git('checkout', '-b', 'release', remote.shas[0]);
    await remote.git('commit', '--allow-empty', '-m', 'release fix');
    const { stdout: releaseTip } = await remote.git('rev-parse', 'HEAD');
    await remote.git('checkout', 'main');
    const work = await clone(remote.dir);
    await work.git('checkout', '-b', 'feature', 'origin/release');
    await work.git('commit', '--allow-empty', '-m', 'work');

    expect(await resolveBaseline({ cwd: work.dir, baseBranch: 'release' })).toBe(releaseTip.trim());
  });

  it('fails for a base branch the remote does not have', async () => {
    const remote = await makeRemote();
    const work = await clone(remote.dir);

    await expect(resolveBaseline({ cwd: work.dir, baseBranch: 'no-such-branch' })).rejects.toThrow(
      /no-such-branch/,
    );
  });

  it('explains that a root commit has nothing behind it', async () => {
    const remote = await makeRemote(['first']);
    const work = await clone(remote.dir);

    await expect(resolveBaseline({ cwd: work.dir })).rejects.toThrow(/HEAD has no parent commit/);
  });
});

describe('resolveBaseline: the canonical remote', () => {
  it('prefers upstream over a fork as origin', async () => {
    const { remote, work } = await makeForkClone('upstream');

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[1]);
  });

  it('prefers upstream when origin is a canonical repository too', async () => {
    const { remote, work } = await makeForkClone('upstream', 'piplupjs');

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[1]);
  });

  it('skips an upstream that is not a canonical repository', async () => {
    const remote = await makeRemote();
    const unrelated = await makeRemote(['other']);
    const work = await clone(remote.dir);
    await setRemote(work.git, 'upstream', 'someone', unrelated.dir);

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[1]);
  });

  it('fails when origin is a fork and there is no upstream', async () => {
    const remote = await makeRemote();
    const work = await clone(remote.dir, { owner: 'someone' });

    await expect(resolveBaseline({ cwd: work.dir })).rejects.toThrow(
      /No canonical remote.*github\.com\/someone\//,
    );
  });

  it('accepts any GitHub origin when package.json names no repository', async () => {
    const remote = await makeRemote(undefined, { owner: null });
    const work = await clone(remote.dir, { owner: 'someone' });

    expect(await resolveBaseline({ cwd: work.dir })).toBe(remote.shas[1]);
  });

  it('does not fall back to a canonical remote under another name', async () => {
    const { work } = await makeForkClone('canonical');

    await expect(resolveBaseline({ cwd: work.dir })).rejects.toThrow(/No canonical remote/);
  });

  it('uses the remote it is given, whatever it points at', async () => {
    const { remote, work } = await makeForkClone('canonical');

    expect(await resolveBaseline({ cwd: work.dir, remote: 'canonical' })).toBe(remote.shas[1]);
  });

  it('fails for a remote the repository does not have', async () => {
    const remote = await makeRemote();
    const work = await clone(remote.dir);

    await expect(resolveBaseline({ cwd: work.dir, remote: 'canonical' })).rejects.toThrow(
      /'canonical'/,
    );
  });
});
