import { getWorkspacePackages } from '../utils/pnpm.mjs';

import { buildSections } from './build-sections.mjs';
import { categorizeCommits } from './categorize-commits.mjs';
import { fetchCommitsBetweenRefs } from './fetch-changelogs.mjs';
import { filterCommits } from './filter-commits.mjs';
import { extractContributorsFromAllCommits, renderChangelog } from './render-changelog.mjs';
import { sortSections } from './sort-sections.mjs';

/**
 * @typedef {import('./types.ts').GenerateChangelogOptions} GenerateChangelogOptions
 * @typedef {import('./types.ts').GenerateChangelogResult} GenerateChangelogResult
 * @typedef {import('./types.ts').ChangelogConfig} ChangelogConfig
 */

/**
 * Generates a changelog for a release.
 *
 * @param {GenerateChangelogOptions} options - Options for generating the changelog
 * @returns {Promise<GenerateChangelogResult>} Changelog result with markdown and sections
 */
export async function generateChangelog(options) {
  const cwd = options.cwd || process.cwd();
  // Fetch commits from GitHub
  const allCommits = await fetchCommitsBetweenRefs({
    repo: options.repo,
    org: options.org || 'piplupjs',
    lastRelease: options.lastRelease,
    release: options.release,
  });
  const config = options.config;
  const commits = filterCommits(allCommits, config.filter);

  // Get workspace packages and their versions
  /**
   * @type {Map<string, string>}
   */
  let packageVersions;
  try {
    const workspacePackages = await getWorkspacePackages({ publicOnly: true, cwd });
    packageVersions = new Map(workspacePackages.map((pkg) => [pkg.name, pkg.version]));
  } catch (error) {
    // If we can't get workspace packages (e.g., not in a pnpm workspace), continue without versions
    packageVersions = new Map();
  }

  // Extract contributors from ALL commits (excluding only excludeAuthors)
  // This ensures contributors are credited even if their commits are filtered out
  const contributors = extractContributorsFromAllCommits(
    commits,
    config.filter?.excludeCommitByAuthors,
  );

  const categories = categorizeCommits(commits, config.categorization);
  const unsortedSections = buildSections(categories, config.categorization, packageVersions);
  const sections = sortSections(unsortedSections, config.categorization);
  const markdown = renderChangelog(sections, config, options, contributors);

  return {
    markdown,
    sections,
    contributors,
  };
}
