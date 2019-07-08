const logger = require('./../utils/logger')
const util = require('util')

module.exports = (link, cmd) => {
  logger.info(`Parsed link: ${link}`)
  logger.info(`Parsed cmd: ${util.inspect(cmd)}`)
}
