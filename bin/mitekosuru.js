#!/usr/bin/env node

const pckg = require('./../package.json')
const program = require('commander')

const download = require('../lib/download')

program.version(pckg.version, '-v, --version')

program
  .command('download <link>', { isDefault: true })
  .alias('dl')
  .alias('d')
  .description('Downloads manga.')
  .option('-d --debug', 'output extra debugging')
  .action((link, cmd) => {
    download(link, cmd)
  })

program.parse(process.argv)

if (process.argv.length === 2) {
  program.outputHelp()
}
