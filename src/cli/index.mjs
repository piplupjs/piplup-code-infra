import { createRequire } from 'node:module';

import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import cmdBaseline from './cmdBaseline.mjs';
import cmdCopyFiles from './cmdCopyFiles.mjs';
import cmdGenerateChangelog from './cmdGenerateChangelog.mjs';
import cmdListWorkspaces from './cmdListWorkspaces.mjs';
import cmdPublish from './cmdPublish.mjs';
import cmdPublishCanary from './cmdPublishCanary.mjs';
import cmdPublishNewPackage from './cmdPublishNewPackage.mjs';
import cmdRenameScope from './cmdRenameScope.mjs';
import cmdSetVersionOverrides from './cmdSetVersionOverrides.mjs';
import cmdValidateBuiltTypes from './cmdValidateBuiltTypes.mjs';

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
