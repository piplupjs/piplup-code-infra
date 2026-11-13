import { createRequire } from 'node:module';

import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import cmdBaseline from './cmd-baseline.mjs';
import cmdCopyFiles from './cmd-copy-files.mjs';
import cmdGenerateChangelog from './cmd-generate-changelog.mjs';
import cmdListWorkspaces from './cmd-list-workspaces.mjs';
import cmdPublishCanary from './cmd-publish-canary.mjs';
import cmdPublishNewPackage from './cmd-publish-new-package.mjs';
import cmdPublish from './cmd-publish.mjs';
import cmdRenameScope from './cmd-rename-scope.mjs';
import cmdSetVersionOverrides from './cmd-set-version-overrides.mjs';
import cmdValidateBuiltTypes from './cmd-validate-built-types.mjs';

const pkgJson = createRequire(import.meta.url)('../../package.json');

/** @type {{ verbose?: boolean }} */
let globalArgv = {};

await yargs(hideBin(process.argv))
  .scriptName('code-infra')
  .usage('$0 <command> [args]')
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    default: false,
    describe: 'Increase output verbosity',
    global: true,
  })
  .middleware((argv) => {
    globalArgv = argv;
  }, true)
  .command(cmdBaseline)
  .command(cmdCopyFiles)
  .command(cmdGenerateChangelog)
  .command(cmdListWorkspaces)
  .command(cmdPublish)
  .command(cmdPublishCanary)
  .command(cmdPublishNewPackage)
  .command(cmdRenameScope)
  .command(cmdSetVersionOverrides)
  .command(cmdValidateBuiltTypes)
  .fail((msg, err, yargsInstance) => {
    if (msg) {
      yargsInstance.showHelp();
      console.error(`\n${msg}`);
    } else if (err) {
      console.error(err.message);
      if (globalArgv.verbose) {
        console.error(chalk.dim(err.stack));
      }
    }
    process.exit(1);
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help()
  .version(pkgJson.version)
  .parseAsync();
