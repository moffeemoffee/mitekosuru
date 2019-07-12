const _ = require('lodash')
const fs = require('fs-extra')
const sanitize = require('sanitize-filename')

const logger = require('./logger')()

const dispatchKeyboardEvent = async (
  page,
  event,
  key,
  code,
  keyCode,
  cancelable = true,
  bubbles = true
) => page.evaluate((eventName, key, code, keyCode, cancelable, bubbles) => {
  const event = new KeyboardEvent(eventName, {
    key: key,
    code: code,
    keyCode: keyCode,
    cancelable: cancelable,
    bubbles: bubbles,
  })
  document.dispatchEvent(event)
}, event, key, code, keyCode, cancelable, bubbles)

const padPageNum = (page, totalPages) => {
  if (typeof totalPages === 'string') {
    totalPages = totalPages.length
  }
  if (typeof totalPages === 'number') {
    totalPages = totalPages.toString().length
  }
  return _.padStart(page++, totalPages, '0')
}

const savePage = async (title, page, totalPages, b64) =>
  fs.outputFile(
    `${sanitize(title)}/${padPageNum(page, totalPages)}.png`,
    b64.replace(/^data:image\/png;base64,/, ''),
    'base64',
    err => { if (err) logger.error(err) }
  )

module.exports = { dispatchKeyboardEvent, padPageNum, savePage }
