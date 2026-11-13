import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, it, expect, vi } from 'vitest';

import {
  checkPublishDependencies,
  getDistTagConflicts,
  getPackagesNeedingManualPublish,
  getPublishRegistry,
  getRegistryPackages,
  getReleaseVersion,
  PLACEHOLDER_VERSION,
  renameWorkspaceScope,
  readPackageJson,
  selectAgedVersion,
  writePackageJson,
  writeOverridesToWorkspace,
} from './pnpm.mjs';
import { makeTempDir, privatePkg, publicPkg, writePackage } from './testUtils.mjs';

/**
 * Build the workspace maps expected by checkPublishDependencies.
 * @param {(import('./pnpm.mjs').PublicPackage | import('./pnpm.mjs').PrivatePackage)[]} allPkgs
 */
function workspaceMaps(allPkgs) {
  /** @type {Map<string, import('./pnpm.mjs').PublicPackage | import('./pnpm.mjs').PrivatePackage>} */
  const byName = new Map(allPkgs.flatMap((p) => (p.name ? [[p.name, p]] : [])));
  const pathByName = new Map(allPkgs.flatMap((p) => (p.name ? [[p.name, p.path]] : [])));
  return { byName, pathByName };
}

describe('checkPublishDependencies', () => {
  describe('workspace: protocol in dependencies', () => {
    it('returns no issues when all workspace: dependencies are included in the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA, pkgB], byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('reports an issue when a workspace: dependency is missing from the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@scope/pkg-b');
      expect(issues[0]).toContain('Add them to the --filter list');
    });

    it('follows an alias spec to the package it targets, not the dependency key', async () => {
      const root = await makeTempDir();
      // Neither key is a workspace package after a rename; only the targets
      // are. Keying on the dependency name would traverse nothing and silently
      // report a clean publish set. The unscoped target matters too: a scoped
      // target's own leading `@` must not be read as the range separator.
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: {
          '@scope/pkg-b': 'workspace:@scope/renamed-b@*',
          'pkg-c': 'workspace:renamed-c@^',
        },
      });
      const bDir = await writePackage(root, 'renamed-b', { name: '@scope/renamed-b' });
      const cDir = await writePackage(root, 'renamed-c', { name: 'renamed-c' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const renamedB = publicPkg('@scope/renamed-b', bDir);
      const renamedC = publicPkg('renamed-c', cDir);
      const { byName, pathByName } = workspaceMaps([pkgA, renamedB, renamedC]);

      const missing = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(missing.issues).toHaveLength(1);
      expect(missing.issues[0]).toContain('@scope/renamed-b');
      expect(missing.issues[0]).toContain('renamed-c');

      const complete = await checkPublishDependencies(
        [pkgA, renamedB, renamedC],
        byName,
        pathByName,
      );
      expect(complete.issues).toEqual([]);
    });

    it('reports an issue when a workspace: dependency is private', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b', private: true });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = privatePkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@scope/pkg-b');
      expect(issues[0]).toContain('private');
    });

    it('resolves transitive workspace: dependencies', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', {
        name: '@scope/pkg-b',
        dependencies: { '@scope/pkg-c': 'workspace:*' },
      });
      const cDir = await writePackage(root, 'pkg-c', { name: '@scope/pkg-c' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const pkgC = publicPkg('@scope/pkg-c', cDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB, pkgC]);

      // publishing only A and B — C is missing but transitively required
      const { issues } = await checkPublishDependencies([pkgA, pkgB], byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@scope/pkg-c');

      // publishing all three — no issues
      const { issues: noIssues } = await checkPublishDependencies(
        [pkgA, pkgB, pkgC],
        byName,
        pathByName,
      );
      expect(noIssues).toEqual([]);
    });
  });

  describe('peerDependencies are never hard requirements', () => {
    it('does not require a peer dependency even when using workspace: protocol', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        peerDependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      // publishing only A — B is a workspace: peer dep but must NOT be required
      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('does not require a peer dependency with a pinned version', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        peerDependencies: { '@scope/pkg-b': '^1.0.0' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('does not require a private peer dependency', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        peerDependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b', private: true });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = privatePkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });

  describe('workspace:^ protocol in dependencies', () => {
    it('requires a workspace:^ dependency that is missing from the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:^' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@scope/pkg-b');
    });

    it('returns no issues when a workspace:^ dependency is included in the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:^' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA, pkgB], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });

  describe('devDependencies are never hard requirements', () => {
    it('does not require a workspace: devDependency missing from the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        devDependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('does not require a workspace:^ devDependency missing from the publish set', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        devDependencies: { '@scope/pkg-b': 'workspace:^' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('does not require a private workspace: devDependency', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        devDependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b', private: true });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = privatePkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });

  describe('pinned versions in dependencies are not hard requirements', () => {
    it('does not require a workspace package referenced with a pinned version in dependencies', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': '^1.0.0' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });

  describe('mixed dependency types', () => {
    it('requires workspace: dependencies but not workspace: peers from the same package', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
        peerDependencies: { '@scope/pkg-c': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', { name: '@scope/pkg-b' });
      const cDir = await writePackage(root, 'pkg-c', { name: '@scope/pkg-c' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const pkgC = publicPkg('@scope/pkg-c', cDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB, pkgC]);

      // B is required (workspace: dep), C is not (workspace: peer)
      const { issues } = await checkPublishDependencies([pkgA, pkgB], byName, pathByName);
      expect(issues).toEqual([]);

      // Omitting B should flag it
      const { issues: missingB } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(missingB).toHaveLength(1);
      expect(missingB[0]).toContain('@scope/pkg-b');
    });

    it('does not traverse peer deps when resolving transitive requirements', async () => {
      const root = await makeTempDir();
      // A depends on B (workspace:), B has C as a peer (workspace:)
      // C should NOT be required just because B peers it
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { '@scope/pkg-b': 'workspace:*' },
      });
      const bDir = await writePackage(root, 'pkg-b', {
        name: '@scope/pkg-b',
        peerDependencies: { '@scope/pkg-c': 'workspace:*' },
      });
      const cDir = await writePackage(root, 'pkg-c', { name: '@scope/pkg-c' });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const pkgB = publicPkg('@scope/pkg-b', bDir);
      const pkgC = publicPkg('@scope/pkg-c', cDir);
      const { byName, pathByName } = workspaceMaps([pkgA, pkgB, pkgC]);

      const { issues } = await checkPublishDependencies([pkgA, pkgB], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });

  describe('large internal workspace simulation', () => {
    /**
     * Mirrors the real package structure of a large internal workspace (packages-internal/*) plus the
     * packages/* that appear as workspace deps.
     *
     * Public packages-internal:
     *   @acme/internal-core-docs   – deps: @acme/internal-markdown (workspace:^)
     *                             – devDeps: @acme/internal-api-docs-builder (workspace:*),
     *                                        @acme/icons (workspace:*), @acme/core (workspace:*)
     *                             – peers: @acme/core, @acme/icons, @acme/system, … (pinned ranges)
     *   @acme/internal-docs-utils  – no workspace deps
     *   @acme/internal-markdown    – no workspace deps
     *   @acme/internal-scripts     – deps: @acme/internal-docs-utils (workspace:^)
     *
     * Private packages-internal:
     *   @acme/internal-api-docs-builder       – deps: @acme/internal-docs-utils (workspace:^),
     *                                                @acme/internal-markdown (workspace:^)
     *   @acme/internal-api-docs-builder-core  – deps: @acme/internal-api-docs-builder (workspace:^),
     *                                                @acme/internal-markdown (workspace:^)
     *   @acme/internal-waterfall              – no workspace deps
     *
     * Public packages/* (not in the --filter set, resolve from registry):
     *   @acme/core, @acme/icons, @acme/system, @acme/utils, @acme/nextjs,
     *   @acme/stylis-plugin-rtl, @acme/core-downloads-tracker, @acme/types,
     *   @acme/pigment-css, @acme/private-theming, @acme/styled-engine
     */
    /** @param {string} root */
    async function buildInternalWorkspace(root) {
      // packages-internal — public
      const coreDocs = await writePackage(root, 'packages-internal/core-docs', {
        name: '@acme/internal-core-docs',
        version: '9.0.0-beta.1',
        dependencies: {
          '@babel/runtime': '^7.29.2',
          '@acme/internal-markdown': 'workspace:^',
          'clipboard-copy': '^4.0.1',
          clsx: '^2.1.1',
        },
        devDependencies: {
          '@acme/internal-api-docs-builder': 'workspace:*',
          '@acme/icons': 'workspace:*',
          '@acme/core': 'workspace:*',
        },
        peerDependencies: {
          '@acme/base': '^5.0.0 || ^7.0.0',
          '@acme/icons': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          '@acme/core': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          '@acme/nextjs': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          '@acme/stylis-plugin-rtl': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          '@acme/system': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          '@acme/utils': '^5.0.0 || ^6.0.0 || ^7.0.0 || ^9.0.0',
          react: '^17.0.0 || ^18.0.0 || ^19.0.0',
        },
      });
      const docsUtils = await writePackage(root, 'packages-internal/docs-utils', {
        name: '@acme/internal-docs-utils',
        version: '3.0.2',
        dependencies: { rimraf: '^6.1.3', typescript: '^5.9.3' },
      });
      const markdown = await writePackage(root, 'packages-internal/markdown', {
        name: '@acme/internal-markdown',
        version: '3.0.6',
        dependencies: { '@babel/runtime': '^7.29.2', marked: '^17.0.5', prismjs: '^1.30.0' },
      });
      const scripts = await writePackage(root, 'packages-internal/scripts', {
        name: '@acme/internal-scripts',
        version: '3.0.5',
        dependencies: {
          '@acme/internal-docs-utils': 'workspace:^',
          '@babel/core': '^7.29.0',
          doctrine: '^3.0.0',
        },
      });

      // packages-internal — private
      const apiDocsBuilder = await writePackage(root, 'packages-internal/api-docs-builder', {
        name: '@acme/internal-api-docs-builder',
        version: '1.0.0',
        private: true,
        dependencies: {
          '@acme/internal-docs-utils': 'workspace:^',
          '@acme/internal-markdown': 'workspace:^',
          '@babel/core': '^7.29.0',
        },
      });
      const apiDocsBuilderCore = await writePackage(
        root,
        'packages-internal/api-docs-builder-core',
        {
          name: '@acme/internal-api-docs-builder-core',
          version: '1.0.0',
          private: true,
          dependencies: {
            '@acme/internal-api-docs-builder': 'workspace:^',
            '@acme/internal-markdown': 'workspace:^',
          },
        },
      );
      const waterfall = await writePackage(root, 'packages-internal/waterfall', {
        name: '@acme/internal-waterfall',
        version: '1.0.0',
        private: true,
      });

      // packages/* — public, resolve from registry (not in the --filter set)
      const core = await writePackage(root, 'packages/core', {
        name: '@acme/core',
        version: '9.0.0-beta.1',
      });
      const iconsM = await writePackage(root, 'packages/icons', {
        name: '@acme/icons',
        version: '9.0.0-beta.1',
      });
      const acmeSystem = await writePackage(root, 'packages/system', {
        name: '@acme/system',
        version: '9.0.0-beta.1',
      });
      const acmeUtils = await writePackage(root, 'packages/utils', {
        name: '@acme/utils',
        version: '9.0.0-beta.1',
      });
      const nextjsPkg = await writePackage(root, 'packages/nextjs', {
        name: '@acme/nextjs',
        version: '9.0.0-beta.0',
      });
      const stylisPluginRtl = await writePackage(root, 'packages/stylis-plugin-rtl', {
        name: '@acme/stylis-plugin-rtl',
        version: '9.0.0-beta.0',
      });

      const publicInternalPkgs = [
        publicPkg('@acme/internal-core-docs', coreDocs),
        publicPkg('@acme/internal-docs-utils', docsUtils),
        publicPkg('@acme/internal-markdown', markdown),
        publicPkg('@acme/internal-scripts', scripts),
      ];
      const privateInternalPkgs = [
        privatePkg('@acme/internal-api-docs-builder', apiDocsBuilder),
        privatePkg('@acme/internal-api-docs-builder-core', apiDocsBuilderCore),
        privatePkg('@acme/internal-waterfall', waterfall),
      ];
      const publicMainPkgs = [
        publicPkg('@acme/core', core),
        publicPkg('@acme/icons', iconsM),
        publicPkg('@acme/system', acmeSystem),
        publicPkg('@acme/utils', acmeUtils),
        publicPkg('@acme/nextjs', nextjsPkg),
        publicPkg('@acme/stylis-plugin-rtl', stylisPluginRtl),
      ];

      const allPkgs = [...publicInternalPkgs, ...privateInternalPkgs, ...publicMainPkgs];
      return { publicInternalPkgs, privateInternalPkgs, publicMainPkgs, allPkgs };
    }

    it('passes with no issues when publishing all public packages-internal packages', async () => {
      const root = await makeTempDir();
      const { publicInternalPkgs, allPkgs } = await buildInternalWorkspace(root);
      const { byName, pathByName } = workspaceMaps(allPkgs);

      const { issues } = await checkPublishDependencies(publicInternalPkgs, byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('passes when @acme/core and other pinned-range peers of core-docs are not in the publish set', async () => {
      const root = await makeTempDir();
      const { publicInternalPkgs, privateInternalPkgs } = await buildInternalWorkspace(root);
      // workspace without the packages/* — simulates --filter "./packages-internal/*"
      const filteredWorkspace = [...publicInternalPkgs, ...privateInternalPkgs];
      const { byName, pathByName } = workspaceMaps(filteredWorkspace);

      const { issues } = await checkPublishDependencies(publicInternalPkgs, byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('passes when workspace:* devDependencies of core-docs are not in the publish set', async () => {
      // core-docs has @acme/internal-api-docs-builder and @acme/icons as workspace:*
      // devDependencies. They must NOT be required — devDeps are not installed on consumer devices.
      const root = await makeTempDir();
      const { publicInternalPkgs, allPkgs } = await buildInternalWorkspace(root);
      const { byName, pathByName } = workspaceMaps(allPkgs);

      const { issues } = await checkPublishDependencies(publicInternalPkgs, byName, pathByName);
      expect(issues).toEqual([]);
    });

    it('flags @acme/internal-markdown as missing when core-docs is published without it', async () => {
      const root = await makeTempDir();
      const { publicInternalPkgs, allPkgs } = await buildInternalWorkspace(root);
      const { byName, pathByName } = workspaceMaps(allPkgs);

      const withoutMarkdown = publicInternalPkgs.filter(
        (p) => p.name !== '@acme/internal-markdown',
      );
      const { issues } = await checkPublishDependencies(withoutMarkdown, byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@acme/internal-markdown');
    });

    it('flags @acme/internal-docs-utils as missing when scripts is published without it', async () => {
      const root = await makeTempDir();
      const { publicInternalPkgs, allPkgs } = await buildInternalWorkspace(root);
      const { byName, pathByName } = workspaceMaps(allPkgs);

      const withoutDocsUtils = publicInternalPkgs.filter(
        (p) => p.name !== '@acme/internal-docs-utils',
      );
      const { issues } = await checkPublishDependencies(withoutDocsUtils, byName, pathByName);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('@acme/internal-docs-utils');
    });

    it('flags both missing workspace: deps when core-docs and scripts lack their deps', async () => {
      const root = await makeTempDir();
      const { publicInternalPkgs, allPkgs } = await buildInternalWorkspace(root);
      const { byName, pathByName } = workspaceMaps(allPkgs);

      const onlyCoreDocs = publicInternalPkgs.filter(
        (p) => p.name !== '@acme/internal-markdown' && p.name !== '@acme/internal-docs-utils',
      );
      const { issues } = await checkPublishDependencies(onlyCoreDocs, byName, pathByName);
      expect(issues).toHaveLength(1); // single issue listing both missing packages
      expect(issues[0]).toContain('@acme/internal-markdown');
      expect(issues[0]).toContain('@acme/internal-docs-utils');
    });
  });

  describe('packages not in the workspace', () => {
    it('ignores dependencies that are not workspace packages', async () => {
      const root = await makeTempDir();
      const aDir = await writePackage(root, 'pkg-a', {
        name: '@scope/pkg-a',
        dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
      });

      const pkgA = publicPkg('@scope/pkg-a', aDir);
      const { byName, pathByName } = workspaceMaps([pkgA]);

      const { issues } = await checkPublishDependencies([pkgA], byName, pathByName);
      expect(issues).toEqual([]);
    });
  });
});

/**
 * Set up a temp workspace with a package.json and optional pnpm-workspace.yaml.
 * @param {object} packageJson - package.json contents
 * @param {string} [workspaceYaml] - pnpm-workspace.yaml contents, omitted to skip the file
 * @returns {Promise<string>} The workspace directory
 */
async function makeWorkspace(packageJson, workspaceYaml) {
  const cwd = await makeTempDir();
  const writes = [writePackageJson(cwd, packageJson)];
  if (workspaceYaml !== undefined) {
    writes.push(fs.writeFile(path.join(cwd, 'pnpm-workspace.yaml'), workspaceYaml));
  }
  await Promise.all(writes);
  return cwd;
}

/**
 * @param {string} cwd
 * @returns {Promise<string>}
 */
function readWorkspaceYaml(cwd) {
  return fs.readFile(path.join(cwd, 'pnpm-workspace.yaml'), 'utf8');
}

describe('writeOverridesToWorkspace', () => {
  describe('writing to pnpm-workspace.yaml', () => {
    it('creates the file with an overrides block when none exists', async () => {
      const cwd = await makeWorkspace({ name: 'root' });

      await writeOverridesToWorkspace(cwd, { foo: '1.2.3' });

      expect(await readWorkspaceYaml(cwd)).toMatchInlineSnapshot(`
        "overrides:
          foo: 1.2.3
        "
      `);
    });

    it('merges into an existing block, preserving comments and quoting scoped names', async () => {
      const cwd = await makeWorkspace(
        { name: 'root' },
        [
          'packages:',
          "  - 'packages/*'",
          'overrides:',
          '  # keep this pin',
          "  bar: '2.0.0'",
          '',
        ].join('\n'),
      );

      await writeOverridesToWorkspace(cwd, { playwright: '1.49.1', '@playwright/test': '1.49.1' });

      expect(await readWorkspaceYaml(cwd)).toMatchInlineSnapshot(`
        "packages:
          - 'packages/*'
        overrides:
          # keep this pin
          bar: '2.0.0'
          playwright: 1.49.1
          "@playwright/test": 1.49.1
        "
      `);
      // The package.json is left untouched.
      expect(await readPackageJson(cwd)).toEqual({ name: 'root' });
    });

    it('overwrites a same-named override, keeping its quote style', async () => {
      const cwd = await makeWorkspace(
        { name: 'root' },
        ['overrides:', "  foo: '1.0.0'", ''].join('\n'),
      );

      await writeOverridesToWorkspace(cwd, { foo: '2.0.0' });

      expect(await readWorkspaceYaml(cwd)).toMatchInlineSnapshot(`
        "overrides:
          foo: '2.0.0'
        "
      `);
    });

    it('prefers the workspace file when both manifests define overrides', async () => {
      const cwd = await makeWorkspace(
        { name: 'root', pnpm: { overrides: { baz: '3.0.0' } } },
        ['overrides:', "  bar: '2.0.0'", ''].join('\n'),
      );

      await writeOverridesToWorkspace(cwd, { foo: '1.2.3' });

      expect(await readWorkspaceYaml(cwd)).toContain('foo: 1.2.3');
      // package.json overrides are left where they were.
      expect(await readPackageJson(cwd)).toEqual({
        name: 'root',
        pnpm: { overrides: { baz: '3.0.0' } },
      });
    });
  });

  describe('writing to package.json', () => {
    it('honors the package.json location when no workspace overrides exist', async () => {
      const cwd = await makeWorkspace({
        name: 'root',
        pnpm: { overrides: { foo: '1.0.0' }, packageExtensions: { thing: {} } },
      });

      await writeOverridesToWorkspace(cwd, { bar: '2.0.0' });

      expect(await readPackageJson(cwd)).toEqual({
        name: 'root',
        pnpm: { overrides: { foo: '1.0.0', bar: '2.0.0' }, packageExtensions: { thing: {} } },
      });
      // No workspace file is created.
      await expect(fs.access(path.join(cwd, 'pnpm-workspace.yaml'))).rejects.toThrow();
    });

    it('lets computed overrides win over an existing package.json override', async () => {
      const cwd = await makeWorkspace({ name: 'root', pnpm: { overrides: { foo: '1.0.0' } } });

      await writeOverridesToWorkspace(cwd, { foo: '2.0.0' });

      expect(await readPackageJson(cwd)).toEqual({
        name: 'root',
        pnpm: { overrides: { foo: '2.0.0' } },
      });
    });
  });

  describe('rejecting resolutions', () => {
    it('throws and writes nothing when package.json has a resolutions field', async () => {
      const cwd = await makeWorkspace({ name: 'root', resolutions: { foo: '1.0.0' } });

      await expect(writeOverridesToWorkspace(cwd, { bar: '2.0.0' })).rejects.toThrow(/resolutions/);
      await expect(fs.access(path.join(cwd, 'pnpm-workspace.yaml'))).rejects.toThrow();
    });

    it('ignores an empty resolutions field', async () => {
      const cwd = await makeWorkspace({ name: 'root', resolutions: {} });

      await writeOverridesToWorkspace(cwd, { foo: '1.2.3' });

      expect(await readWorkspaceYaml(cwd)).toContain('foo: 1.2.3');
    });
  });
});

describe('getPublishRegistry', () => {
  it('prefers publishConfig.registry over the ambient registry', async () => {
    const root = await makeTempDir();
    vi.stubEnv('npm_config_registry', 'https://registry.npmjs.org/');
    const pkgDir = await writePackage(root, 'pkg', {
      name: 'my-package',
      version: '1.0.0',
      publishConfig: { registry: 'https://npm.example.com/' },
    });

    expect(await getPublishRegistry(pkgDir)).toBe('https://npm.example.com/');
  });

  it('falls back to the ambient registry', async () => {
    const root = await makeTempDir();
    vi.stubEnv('npm_config_registry', 'https://npm.example.com/');
    const pkgDir = await writePackage(root, 'pkg', { name: 'my-package', version: '1.0.0' });

    expect(await getPublishRegistry(pkgDir)).toBe('https://npm.example.com/');
  });

  it('defaults to the public npm registry', async () => {
    const root = await makeTempDir();
    vi.stubEnv('npm_config_registry', undefined);
    const pkgDir = await writePackage(root, 'pkg', { name: 'my-package', version: '1.0.0' });

    expect(await getPublishRegistry(pkgDir)).toBe('https://registry.npmjs.org/');
  });

  it('collapses repeated trailing slashes to exactly one', async () => {
    const root = await makeTempDir();
    const pkgDir = await writePackage(root, 'pkg', {
      name: 'my-package',
      version: '1.0.0',
      publishConfig: { registry: 'https://npm.example.com///' },
    });

    expect(await getPublishRegistry(pkgDir)).toBe('https://npm.example.com/');
  });

  it('adds the trailing slash a path-prefixed registry needs', async () => {
    const root = await makeTempDir();
    const pkgDir = await writePackage(root, 'pkg', {
      name: 'my-package',
      version: '1.0.0',
      publishConfig: { registry: 'https://artifactory.example.com/api/npm/npm-repo' },
    });

    expect(await getPublishRegistry(pkgDir)).toBe(
      'https://artifactory.example.com/api/npm/npm-repo/',
    );
  });

  it('names the package and the value when the registry is unparseable', async () => {
    const root = await makeTempDir();
    const pkgDir = await writePackage(root, 'pkg', {
      name: 'my-package',
      version: '1.0.0',
      publishConfig: { registry: 'npm.example.com' },
    });

    await expect(getPublishRegistry(pkgDir)).rejects.toThrow(
      /Invalid publish registry "npm\.example\.com" for the package at /,
    );
  });

  it('normalizes host casing and the default port', async () => {
    const root = await makeTempDir();
    const pkgDir = await writePackage(root, 'pkg', {
      name: 'my-package',
      version: '1.0.0',
      publishConfig: { registry: 'https://REGISTRY.npmjs.org:443' },
    });

    expect(await getPublishRegistry(pkgDir)).toBe('https://registry.npmjs.org/');
  });
});

describe('getReleaseVersion', () => {
  const WORKSPACE_YAML = "packages:\n  - 'packages/*'\n";

  it('reads the version from the workspace-root manifest', async () => {
    const root = await makeWorkspace({ name: 'root', version: '1.2.3' }, WORKSPACE_YAML);

    expect(await getReleaseVersion(root)).toBe('1.2.3');
  });

  it('resolves the workspace root when invoked from a package directory', async () => {
    const root = await makeWorkspace({ name: 'root', version: '4.5.6' }, WORKSPACE_YAML);
    // A package under the workspace declares its own, unrelated version.
    const pkgDir = await writePackage(root, 'packages/widget', {
      name: '@scope/widget',
      version: '0.0.0',
    });

    // The release version is the root's, not the package the command ran from.
    expect(await getReleaseVersion(pkgDir)).toBe('4.5.6');
  });

  it('normalizes a valid but non-canonical version', async () => {
    const root = await makeWorkspace({ name: 'root', version: 'v2.0.0' }, WORKSPACE_YAML);

    expect(await getReleaseVersion(root)).toBe('2.0.0');
  });

  it('returns null when no version is present', async () => {
    const root = await makeWorkspace({ name: 'root' }, WORKSPACE_YAML);

    expect(await getReleaseVersion(root)).toBeNull();
  });

  it('returns null for a version that is not valid semver', async () => {
    const root = await makeWorkspace({ name: 'root', version: 'not-a-version' }, WORKSPACE_YAML);

    expect(await getReleaseVersion(root)).toBeNull();
  });
});

describe('getRegistryPackages', () => {
  it('skips packages on another registry with npmOnly, without a registry request', async () => {
    const root = await makeTempDir();
    const pkgDir = await writePackage(root, 'pkg', {
      name: '@scope/private',
      version: '1.0.0',
      publishConfig: { registry: 'https://npm.example.com/' },
    });

    const registryPackages = await getRegistryPackages([publicPkg('@scope/private', pkgDir)], {
      npmOnly: true,
    });

    expect(registryPackages.size).toBe(0);
  });
});

describe('getPackagesNeedingManualPublish', () => {
  /**
   * Find the packages that need a manual first publish, against registry data.
   * @param {Record<string, { exists: boolean, registry?: string }>} packages
   *   Registry data of each package, by name. The registry defaults to npm.
   */
  function findNewPackages(packages) {
    const entries = Object.entries(packages);
    const newPackages = getPackagesNeedingManualPublish(
      entries.map(([name]) => publicPkg(name, `/workspace/${name}`)),
      new Map(
        entries.map(([name, { exists, registry = 'https://registry.npmjs.org/' }]) => [
          name,
          { registry, exists, distTags: {}, versions: [] },
        ]),
      ),
    );
    return newPackages.map((pkg) => pkg.name);
  }

  it('returns the packages that are not on npm yet', () => {
    expect(findNewPackages({ new: { exists: false }, existing: { exists: true } })).toEqual([
      'new',
    ]);
  });

  it('skips packages that publish to another registry', () => {
    expect(
      findNewPackages({ private: { exists: false, registry: 'https://npm.example.com/' } }),
    ).toEqual([]);
  });
});

describe('getDistTagConflicts', () => {
  /**
   * Find the conflicts of a publish with `tag` against registry data.
   * @param {string} tag - Dist-tag to publish with
   * @param {Record<string, { version: string, distTags?: Record<string, string>, versions?: string[] }>} packages
   *   Version to publish and registry data of each package, by name. No `distTags` means not on the registry.
   */
  function findConflicts(tag, packages) {
    const entries = Object.entries(packages);
    const conflicts = getDistTagConflicts(
      entries.map(([name, { version }]) => ({ ...publicPkg(name, `/workspace/${name}`), version })),
      tag,
      new Map(
        entries.map(([name, { distTags, versions }]) => [
          name,
          {
            registry: 'https://registry.npmjs.org/',
            exists: distTags !== undefined,
            distTags: distTags ?? {},
            versions: versions ?? Object.values(distTags ?? {}),
          },
        ]),
      ),
    );
    return conflicts.map(({ pkg, reason }) => `${pkg.name}: ${reason}`);
  }

  it('rejects a lower version on any dist-tag', () => {
    expect(
      findConflicts('latest', { grid: { version: '8.29.6', distTags: { latest: '9.15.0' } } }),
    ).toEqual([
      'grid: "latest" can only move to a newer version, but 8.29.6 is lower than the current 9.15.0',
    ]);
    expect(
      findConflicts('next', {
        virtualizer: { version: '0.7.4', distTags: { next: '1.0.0-rc.0' } },
      }),
    ).toEqual([
      'virtualizer: "next" can only move to a newer version, but 0.7.4 is lower than the current 1.0.0-rc.0',
    ]);
  });

  it('rejects a prerelease on latest dist-tags that point to a stable version', () => {
    expect(
      findConflicts('latest', {
        core: { version: '10.0.0-alpha.1', distTags: { latest: '9.5.0' } },
        grid: { version: '9.16.0-beta.0', distTags: { latest: '9.15.0' } },
      }),
    ).toEqual([
      'core: "latest" cannot point to a prerelease (10.0.0-alpha.1)',
      'grid: "latest" cannot point to a prerelease (9.16.0-beta.0)',
    ]);
    expect(
      findConflicts('latest-v7', {
        lab: { version: '7.4.0-beta.0', distTags: { 'latest-v7': '7.3.11' } },
      }),
    ).toEqual(['lab: "latest-v7" cannot point to a prerelease (7.4.0-beta.0)']);
  });

  it('allows a prerelease on latest dist-tags that already point to one', () => {
    expect(
      findConflicts('latest', {
        // An unstable package moves to the new major together with a stable release.
        lab: { version: '9.0.0-beta.2', distTags: { latest: '7.0.1-beta.23' } },
        scheduler: { version: '9.0.0-beta.14', distTags: { latest: '9.0.0-beta.13' } },
      }),
    ).toEqual([]);
  });

  it('rejects a different major on latest-* dist-tags', () => {
    expect(
      findConflicts('latest-v8', {
        grid: { version: '9.16.0', distTags: { 'latest-v8': '8.29.5' } },
        virtualizer: { version: '0.4.3', distTags: { 'latest-v8': '0.4.2' } },
      }),
    ).toEqual(['grid: "latest-v8" cannot cross a major (8.29.5 to 9.16.0)']);
  });

  it('allows a new major on latest and a prerelease on other dist-tags', () => {
    expect(
      findConflicts('latest', { grid: { version: '10.0.0', distTags: { latest: '9.15.0' } } }),
    ).toEqual([]);
    expect(
      findConflicts('next', {
        grid: { version: '10.0.0-alpha.1', distTags: { next: '9.16.0' } },
      }),
    ).toEqual([]);
  });

  it('skips versions that are already published', () => {
    expect(
      findConflicts('latest', {
        charts: {
          version: '8.29.3',
          distTags: { latest: '9.15.0' },
          versions: ['8.29.3', '9.15.0'],
        },
      }),
    ).toEqual([]);
  });

  it('skips packages and dist-tags that are not on the registry yet', () => {
    expect(
      findConflicts('latest-v9', {
        new: { version: '1.0.0' },
        grid: { version: '9.20.0', distTags: { latest: '10.0.0' } },
      }),
    ).toEqual([]);
  });

  it('treats the placeholder of a new package as no dist-tag', () => {
    expect(
      findConflicts('latest', {
        chat: {
          version: '9.0.0-alpha.0',
          distTags: { latest: PLACEHOLDER_VERSION, canary: PLACEHOLDER_VERSION },
        },
      }),
    ).toEqual([]);
  });
});

describe('selectAgedVersion', () => {
  const cutoff = Date.parse('2026-07-24T00:00:00Z');
  const times = {
    '7.0.4': '2026-07-01T08:00:00Z',
    '7.1.0': '2026-07-02T08:00:00Z',
    '7.1.0-dev.1': '2026-07-22T08:00:00Z',
    '7.1.0-dev.2': '2026-07-23T08:00:00Z',
    '7.1.0-dev.3': '2026-07-27T08:00:00Z',
    '7.2.0': '2026-07-27T08:00:00Z',
  };
  const versions = Object.keys(times);

  it('keeps the resolved version when it has already aged in', () => {
    expect(selectAgedVersion('next', '7.1.0-dev.2', versions, times, cutoff)).toBe('7.1.0-dev.2');
  });

  it('keeps the resolved version when its publish date is unknown', () => {
    expect(selectAgedVersion('next', '9.9.9', versions, times, cutoff)).toBe('9.9.9');
  });

  describe('dist-tag', () => {
    it('repoints to the highest aged-in version of the same major', () => {
      expect(selectAgedVersion('next', '7.1.0-dev.3', versions, times, cutoff)).toBe('7.1.0-dev.2');
    });

    it('does not cross prerelease-ness', () => {
      // 7.1.0 has aged in, but a prerelease tag stays on prereleases.
      expect(selectAgedVersion('next', '7.1.0-dev.3', ['7.1.0'], times, cutoff)).toBe(null);
    });

    it('does not cross majors', () => {
      const across = { '6.9.0': '2026-01-01T08:00:00Z', '7.2.0': '2026-07-27T08:00:00Z' };
      expect(selectAgedVersion('next', '7.2.0', Object.keys(across), across, cutoff)).toBe(null);
    });

    it('lets `latest` cross majors, as pnpm does', () => {
      const across = { '6.9.0': '2026-01-01T08:00:00Z', '7.2.0': '2026-07-27T08:00:00Z' };
      expect(selectAgedVersion('latest', '7.2.0', Object.keys(across), across, cutoff)).toBe(
        '6.9.0',
      );
    });

    it('ignores versions that are unpublished but still dated', () => {
      // '7.1.0-dev.2' has a date but no longer appears in the version list.
      const published = versions.filter((version) => version !== '7.1.0-dev.2');
      expect(selectAgedVersion('next', '7.1.0-dev.3', published, times, cutoff)).toBe(
        '7.1.0-dev.1',
      );
    });

    it('returns null when nothing has aged in', () => {
      const fresh = { '7.1.0-dev.3': '2026-07-27T08:00:00Z' };
      expect(selectAgedVersion('next', '7.1.0-dev.3', Object.keys(fresh), fresh, cutoff)).toBe(
        null,
      );
    });
  });

  describe('range', () => {
    it('stays inside the requested range', () => {
      // The tag rule would offer 7.1.0; ^7.2.0 must not step below itself.
      expect(selectAgedVersion('^7.2.0', '7.2.0', versions, times, cutoff)).toBe(null);
    });

    it('picks the highest aged-in version satisfying the range', () => {
      expect(selectAgedVersion('^7.0.0', '7.2.0', versions, times, cutoff)).toBe('7.1.0');
    });
  });

  describe('exact version', () => {
    it('stands rather than stepping back to a different build', () => {
      expect(selectAgedVersion('7.2.0', '7.2.0', versions, times, cutoff)).toBe('7.2.0');
    });
  });

  describe('cooldown exemptions', () => {
    // 7.2.0 and 7.3.0 are both too recent, but an exemption makes 7.2.0
    // installable anyway.
    const excluded = {
      '7.1.0': '2026-07-02T08:00:00Z',
      '7.2.0': '2026-07-26T08:00:00Z',
      '7.3.0': '2026-07-27T08:00:00Z',
    };
    const excludedVersions = Object.keys(excluded);

    it('offers an exempt version to a range that would otherwise step further back', () => {
      expect(
        selectAgedVersion('^7.0.0', '7.3.0', excludedVersions, excluded, cutoff, ['7.2.0']),
      ).toBe('7.2.0');
    });

    it('offers an exempt version to a dist-tag', () => {
      expect(
        selectAgedVersion('latest', '7.3.0', excludedVersions, excluded, cutoff, ['7.2.0']),
      ).toBe('7.2.0');
    });

    it('resolves rather than failing when only an exempt version qualifies', () => {
      const fresh = { '7.2.0': '2026-07-26T08:00:00Z', '7.3.0': '2026-07-27T08:00:00Z' };
      expect(selectAgedVersion('^7.0.0', '7.3.0', Object.keys(fresh), fresh, cutoff)).toBe(null);
      expect(
        selectAgedVersion('^7.0.0', '7.3.0', Object.keys(fresh), fresh, cutoff, ['7.2.0']),
      ).toBe('7.2.0');
    });
  });
});

describe('renameWorkspaceScope', () => {
  it('renames the package and aliases its dependents without touching imports', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const docs = await writePackage(root, 'docs', {
      name: 'docs',
      version: '1.0.0',
      private: true,
      dependencies: {
        '@piplup/mosaic': 'workspace:*',
        // Same scope, but from the registry — these must not be rewritten.
        '@piplup/react': '^1.6.0',
        '@piplup/utils': '^0.3.1',
      },
    });

    const renamed = await renameWorkspaceScope(
      [publicPkg('@piplup/mosaic', mosaic), privatePkg('docs', docs)],
      '@piplup',
      '@piplup-private',
    );

    expect(Object.fromEntries(renamed)).toEqual({ '@piplup/mosaic': '@piplup-private/mosaic' });
    expect((await readPackageJson(mosaic)).name).toBe('@piplup-private/mosaic');
    // The dependency keeps its original name, so `import '@piplup/mosaic'` still resolves.
    expect((await readPackageJson(docs)).dependencies).toEqual({
      '@piplup/mosaic': 'workspace:@piplup-private/mosaic@*',
      '@piplup/react': '^1.6.0',
      '@piplup/utils': '^0.3.1',
    });
  });

  it('renames and aliases within a package that is itself renamed', async () => {
    const root = await makeTempDir();
    const core = await writePackage(root, 'core', { name: '@piplup/core', version: '1.0.0' });
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
      dependencies: { '@piplup/core': 'workspace:^' },
    });

    await renameWorkspaceScope(
      [publicPkg('@piplup/core', core), publicPkg('@piplup/mosaic', mosaic)],
      '@piplup',
      '@piplup-private',
    );

    const manifest = await readPackageJson(mosaic);
    // Both halves land in one manifest: its own name and the dep it aliases.
    expect(manifest.name).toBe('@piplup-private/mosaic');
    expect(manifest.dependencies?.['@piplup/core']).toBe('workspace:@piplup-private/core@^');
  });

  it('leaves private workspace packages under the original scope', async () => {
    const root = await makeTempDir();
    const tests = await writePackage(root, 'tests', {
      name: '@piplup/monorepo-tests',
      version: '1.0.0',
      private: true,
    });

    const renamed = await renameWorkspaceScope(
      [privatePkg('@piplup/monorepo-tests', tests)],
      '@piplup',
      '@piplup-private',
    );

    expect(renamed.size).toBe(0);
    expect((await readPackageJson(tests)).name).toBe('@piplup/monorepo-tests');
  });

  it('leaves dependencies on private same-scope packages untouched', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const tests = await writePackage(root, 'tests', {
      name: '@piplup/monorepo-tests',
      version: '1.0.0',
      private: true,
    });
    const consumer = await writePackage(root, 'consumer', {
      name: 'consumer',
      version: '1.0.0',
      private: true,
      devDependencies: {
        '@piplup/mosaic': 'workspace:*',
        '@piplup/monorepo-tests': 'workspace:*',
      },
    });

    await renameWorkspaceScope(
      [
        publicPkg('@piplup/mosaic', mosaic),
        privatePkg('@piplup/monorepo-tests', tests),
        privatePkg('consumer', consumer),
      ],
      '@piplup',
      '@piplup-private',
    );

    const deps = (await readPackageJson(consumer)).devDependencies ?? {};
    expect(deps['@piplup/mosaic']).toBe('workspace:@piplup-private/mosaic@*');
    // The private package was never renamed, so pointing at a renamed copy
    // would reference a package that does not exist.
    expect(deps['@piplup/monorepo-tests']).toBe('workspace:*');
  });

  it('leaves peerDependencies alone, since a consumer supplies them', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const consumer = await writePackage(root, 'consumer', {
      name: 'consumer',
      version: '1.0.0',
      private: true,
      peerDependencies: { '@piplup/mosaic': 'workspace:^' },
    });

    await renameWorkspaceScope(
      [publicPkg('@piplup/mosaic', mosaic), privatePkg('consumer', consumer)],
      '@piplup',
      '@piplup-private',
    );

    expect((await readPackageJson(consumer)).peerDependencies?.['@piplup/mosaic']).toBe(
      'workspace:^',
    );
  });

  it('writes nothing when a renamed dependency is not a workspace: dep', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const consumer = await writePackage(root, 'consumer', {
      name: 'consumer',
      version: '1.0.0',
      private: true,
      dependencies: { '@piplup/mosaic': '^1.0.0' },
    });
    // A dependent that would rewrite cleanly, to prove the failure elsewhere
    // suppresses it rather than leaving the workspace half renamed.
    const docs = await writePackage(root, 'docs', {
      name: 'docs',
      version: '1.0.0',
      private: true,
      dependencies: { '@piplup/mosaic': 'workspace:*' },
    });

    await expect(
      renameWorkspaceScope(
        [
          publicPkg('@piplup/mosaic', mosaic),
          privatePkg('consumer', consumer),
          privatePkg('docs', docs),
        ],
        '@piplup',
        '@piplup-private',
      ),
    ).rejects.toThrow(/rather than a workspace: dependency/);

    expect((await readPackageJson(mosaic)).name).toBe('@piplup/mosaic');
    expect((await readPackageJson(docs)).dependencies?.['@piplup/mosaic']).toBe('workspace:*');
  });

  it('fails when a rename would collide with a package that keeps its name', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    // Already under the target scope, so it keeps its name — the rename of the
    // package above would land on top of it.
    const existing = await writePackage(root, 'existing', {
      name: '@piplup-private/mosaic',
      version: '1.0.0',
    });

    await expect(
      renameWorkspaceScope(
        [publicPkg('@piplup/mosaic', mosaic), publicPkg('@piplup-private/mosaic', existing)],
        '@piplup',
        '@piplup-private',
      ),
    ).rejects.toThrow(/both be named @piplup-private\/mosaic/);

    expect((await readPackageJson(mosaic)).name).toBe('@piplup/mosaic');
  });

  it('refuses to rename a scope onto itself', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });

    await expect(
      renameWorkspaceScope([publicPkg('@piplup/mosaic', mosaic)], '@piplup', '@piplup'),
    ).rejects.toThrow(/rename @piplup to itself/);

    // The no-op mapping must not have rewritten the manifest to itself.
    expect((await readPackageJson(mosaic)).name).toBe('@piplup/mosaic');
  });

  it('recovers from a partial run where the dependent was already aliased', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const docs = await writePackage(root, 'docs', {
      name: 'docs',
      version: '1.0.0',
      private: true,
      dependencies: { '@piplup/mosaic': 'workspace:@piplup-private/mosaic@*' },
    });

    await renameWorkspaceScope(
      [publicPkg('@piplup/mosaic', mosaic), privatePkg('docs', docs)],
      '@piplup',
      '@piplup-private',
    );

    expect((await readPackageJson(mosaic)).name).toBe('@piplup-private/mosaic');
    expect((await readPackageJson(docs)).dependencies?.['@piplup/mosaic']).toBe(
      'workspace:@piplup-private/mosaic@*',
    );
  });

  it('fails on a spec already aliased at a package being renamed', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const consumer = await writePackage(root, 'consumer', {
      name: 'consumer',
      version: '1.0.0',
      private: true,
      dependencies: { 'mosaic-alias': 'workspace:@piplup/mosaic@*' },
    });

    await expect(
      renameWorkspaceScope(
        [publicPkg('@piplup/mosaic', mosaic), privatePkg('consumer', consumer)],
        '@piplup',
        '@piplup-private',
      ),
    ).rejects.toThrow(/already aliases @piplup\/mosaic/);
  });

  it('rewrites dependency specs across every dependency field', async () => {
    const root = await makeTempDir();
    const mosaic = await writePackage(root, 'mosaic', {
      name: '@piplup/mosaic',
      version: '1.0.0',
    });
    const consumer = await writePackage(root, 'consumer', {
      name: 'consumer',
      version: '1.0.0',
      private: true,
      devDependencies: { '@piplup/mosaic': 'workspace:*' },
      optionalDependencies: { '@piplup/mosaic': 'workspace:^' },
    });

    await renameWorkspaceScope(
      [publicPkg('@piplup/mosaic', mosaic), privatePkg('consumer', consumer)],
      '@piplup',
      '@piplup-private',
    );

    const manifest = await readPackageJson(consumer);
    expect(manifest.devDependencies?.['@piplup/mosaic']).toBe('workspace:@piplup-private/mosaic@*');
    expect(manifest.optionalDependencies?.['@piplup/mosaic']).toBe(
      'workspace:@piplup-private/mosaic@^',
    );
  });

  it('does nothing when no package matches the scope', async () => {
    const root = await makeTempDir();
    const other = await writePackage(root, 'other', { name: '@acme/core', version: '1.0.0' });
    // A scope is a whole path segment, so a package merely sharing the prefix
    // is not in scope.
    const neighbour = await writePackage(root, 'neighbour', {
      name: '@piplup-extra/thing',
      version: '1.0.0',
    });

    const renamed = await renameWorkspaceScope(
      [publicPkg('@acme/core', other), publicPkg('@piplup-extra/thing', neighbour)],
      '@piplup',
      '@piplup-private',
    );

    expect(renamed.size).toBe(0);
    expect((await readPackageJson(other)).name).toBe('@acme/core');
    expect((await readPackageJson(neighbour)).name).toBe('@piplup-extra/thing');
  });
});
