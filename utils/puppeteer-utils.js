const dispatchKeyboardEvent = (
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

module.exports = { dispatchKeyboardEvent }
