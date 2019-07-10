const chalk = require('chalk')
const { createLogger, format, transports } = require('winston')

module.exports = createLogger({
  level: 'debug',
  format: format.combine(
    format.colorize(),
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.printf(
      info => `[${chalk.magenta('Mitekosuru')}] ${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [new transports.Console({ level: 'debug' })]
})
