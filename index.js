const pjson = require('./package.json')
const program = require('commander')

program
  .version(pjson.version)
  .option('-d --debug', 'output extra debugging')
  .parse(process.argv)

module.exports = () => {}
