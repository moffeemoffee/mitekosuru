const chalk = require('chalk')
const pckg = require('../package.json')

module.exports = `[${chalk.magenta(`mitekosuru@${pckg.version}`)}]`
