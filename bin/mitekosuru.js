#!/usr/bin/env node

const pckg = require('./../package.json')
const program = require('commander')

const download = require('../lib/download')

program.version(pckg.version, '-v, --version')

program
  .command('download <link>', { isDefault: true })
  .alias('dl')
  .description('Downloads manga.')
  .option('-i --item [value]', 'automatically set which item to download (note that the list is ascending)', '')
  .option('-g --gui', 'show graphical user interface of browser (non-headless mode)', false)
  .option('-t --timeout [value]', 'changes default timeout of ALL requests in ms (default: 30000ms)', 30000)
  .option('-v --verbose', 'increase output verbosity', false)
  .option('-d --debug', 'increase output verbosity even more', false)
  .option('--silly', 'stupid amounts of output verbosity', false)
  .action((link, cmd) => {
    download(link, cmd)
  })

program.parse(process.argv)

if (process.argv.length === 2) {
  program.outputHelp()
}
