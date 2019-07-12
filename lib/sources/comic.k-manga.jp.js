const $ = require('cheerio')
require('cheerio-get-css-selector').init($)
const ora = require('ora')

const logger = require('../../utils/logger')()
const loggerPrefix = require('../../utils/logger-prefix')
const dlUtils = require('../../utils/download-utils')

const download = async (page, title) => {
  logger.debug('Waiting for page to load...')
  await page.waitForSelector('#ind-current-page')
  await page.waitForSelector('#ind-total-pages')
  await page.waitFor(() => !isNaN(parseInt(document.getElementById('ind-total-pages').innerText)))
  logger.debug('Finished waiting.')

  // Get page numbers
  const startPageNum = await page.$eval('#ind-current-page', el => parseInt(el.innerText))
  const totalPageNum = await page.$eval('#ind-total-pages', el => parseInt(el.innerText))
  let currentPageNum = startPageNum

  // Also accounts for odd pages (since furthest you can get is a multiple of two)
  // const roundedLastPage = Math.floor(totalPageNum / 2) * 2
  // const isLastPage = async () => page.$eval('#ind-current-page', el => parseInt(el.innerText)) === roundedLastPage

  // TODO: Check if isn't on first page

  // Download pages
  const dlSpinner = ora({
    text: `Downloading pages (00/${totalPageNum})...\n`,
    prefixText: loggerPrefix,
  }).start()
  // while ((await isLastPage()) === false) {
  while (currentPageNum < totalPageNum) {
    // Check if loading
    logger.debug('Waiting for images to load...')
    await page.waitFor(() => document.getElementById('guard').style.visibility === 'hidden')
    logger.debug('Finished waiting.')

    // Download
    const canvDivs = await page.$$('#viewport > div.nv-pvImageCanvas[style*="opacity: 1"]')
    const canvDivFinders = Array.from(canvDivs)
    const cmpCanvDivsArray = await Promise.all(
      canvDivFinders.map(async div =>
        [await page.evaluate(div => parseInt(div.style.transform.replace(/^translate[()]/, '')), div), div])
    )
    cmpCanvDivsArray.sort((a, b) => a[0] < b[0])
    const sortedCanvDivs = cmpCanvDivsArray.map(x => x[1])
    for (const canvDiv of sortedCanvDivs) {
      const imgB64 = await canvDiv.$eval('canvas', canv => canv.toDataURL())
      await dlUtils.savePage(title, currentPageNum, totalPageNum, imgB64)
      dlSpinner.text = `Downloading pages (${dlUtils.padPageNum(currentPageNum, totalPageNum)}/${totalPageNum})...`
      await dlUtils.dispatchKeyboardEvent(page, 'keyup', 'ArrowLeft', 'ArrowLeft', 37)
      currentPageNum++
    }
  }
  dlSpinner.succeed(`Finished downloading all ${totalPageNum} pages.`)
}

module.exports = {
  pathnameMatch: pathname => pathname.match(/^\/title\/\d+/) !== null,
  initialWaitUntil: 'domcontentloaded',
  initialWaitUntilFn: null,
  listParse: (pageContent, url) => {
    let titles = $('div.book-chapter--item > div > div > h2 > a', pageContent)
      .map((i, elem) => $(elem).text().trim())
      .get()
    const hrefs = $('div.book-chapter--item > div > div > div.f14.pc-detail-btn-group > a.btn.book-chapter--btn__jikuri.x-invoke-viewer--btn__selector', pageContent)
      .map((i, elem) => `${url.origin}${$(elem).attr('href').trim()}`)
      .get()
    // TODO: Add support for downloading paid chapter previews
    if (titles.length > hrefs.length) {
      logger.verbose(`Removed ${titles.length - hrefs.length} paid volumes.`)
      titles = titles.slice(0, hrefs.length)
    }
    return { titles, hrefs }
  },
  download: async (page, href, title) => {
    await page.goto(href, { waitUntil: 'networkidle0' })
    logger.verbose('Page loaded')

    // Begin saving procedure
    await download(page, title)
  },
}
