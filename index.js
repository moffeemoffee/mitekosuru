const program = require('commander')

program
  .version('0.0.1')
  .option('-d --debug', 'output extra debugging')

program.parse(process.argv)

module.exports = () => {}
