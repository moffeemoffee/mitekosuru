const { createLogger, format, transports } = require('winston')
const loggerPrefix = require('./logger-prefix')

let logger = null

module.exports = (level = null) => {
  if (logger === null) {
    if (level === null) level = 'info'
    logger = createLogger({
      level: level,
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          info => `${loggerPrefix} ${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
      transports: [new transports.Console({ level: level })],
    })
  } else if (level !== null && logger.level !== level) {
    logger.level = level
    logger.transports.forEach(transpo => { transpo.level = level })
    if (level === 'silly') {
      logger.warn('Logging in silly mode. Good luck!')
    } else if (level === 'debug' || level === 'verbose') {
      logger.info(`Logging in ${level} mode.`)
    }
  }

  return logger
}
