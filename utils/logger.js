const chalk = require('chalk')
const { createLogger, format, transports } = require('winston')

const pckg = require('./../package.json')

module.exports = createLogger({
  level: 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.printf(
      (info) => `[${chalk.magenta(`mitekosuru@${pckg.version}`)}] ${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [new transports.Console({ level: 'info' })],
})
