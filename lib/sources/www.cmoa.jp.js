const $ = require('cheerio')
require('cheerio-get-css-selector').init($)
const _ = require('lodash')
const fs = require('fs-extra')
const ora = require('ora')
const prettyMs = require('pretty-ms')
const sanitize = require('sanitize-filename')
const sleep = require('await-sleep')

const logger = require('../../utils/logger')()
const loggerPrefix = require('../../utils/logger-prefix')

const beginSavingProcess = async (page, title) => {
  // Get content divs
  const containerDiv = await page.$('#content')
  const contentDivs = await containerDiv.$$('div[id^=content-p]')

  // Get viewport size
  const { width: vpWidth, height: vpHeight } = page.viewport()
  logger.verbose(`Current viewport size: (${vpWidth}, ${vpHeight})`)

  // Set viewport size
  await page.waitForSelector('#content-p1 > div > div:nth-child(1) > img')
  const imgWidth = await page.$eval('#content-p1 > div > div:nth-child(1) > img', (el) => el.width)
  const imgTransformScaleY = await page.evaluate(
    () => Number(document.querySelector('#content-p1 > div > div:nth-child(1) > img')
      .style.transform
      .replace(/,\s+/g, ',')
      .split(/\s+/)
      .find((part) => part.startsWith('scale'))
      .match(/\d+(\.\d+)?/)[0]
    )
  )
  const imgHeight = Math.round(vpHeight / imgTransformScaleY)
  await page.setViewport({ width: imgWidth, height: imgHeight })

  // Get new dimensions
  const { width: newVpWidth, height: newVpHeight } = page.viewport()
  logger.verbose(`Viewport resized to (${newVpWidth}, ${newVpHeight})`)

  // Attempt to fix first page
  await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      keyCode: 37,
      cancelable: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  })
  await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      keyCode: 39,
      cancelable: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  })

  logger.verbose('Waiting for images to resize...')
  await page.waitForFunction(() => {
    return Number(document.querySelector('#content-p1 > div > div:nth-child(1) > img')
      .style.transform
      .replace(/,\s+/g, ',')
      .split(/\s+/)
      .find((part) => part.startsWith('scale'))
      .match(/\d+(\.\d+)?/)[0]
    ) === 1
  })

  // Download pages
  const dlSpinner = ora({
    text: `Downloading pages (00/${contentDivs.length})...\n`,
    prefixText: loggerPrefix,
  }).start()
  for (const contentDiv of contentDivs) {
    let pageNumber = (await (await contentDiv.getProperty('id')).jsonValue()).substr(9)
    pageNumber = _.padStart(pageNumber, contentDivs.length.toString().length, '0')
    logger.verbose(`Downloading page ${pageNumber}...`)

    // Download page
    await downloadContent(contentDiv, pageNumber, title, newVpWidth, newVpHeight)
    dlSpinner.text = `Downloading pages (${pageNumber}/${contentDivs.length})...`

    logger.debug('Sending ArrowLeft')
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        code: 'ArrowLeft',
        keyCode: 37,
        cancelable: true,
        bubbles: true,
      })
      document.dispatchEvent(event)
    })
  }
  dlSpinner.succeed(`Finished downloading all ${contentDivs.length} pages.`)
}

const downloadContent = async (contentDiv, pageNumber, title, canvWidth, canvHeight) => {
  const cachedImageSrcs = []
  let imgB64Data

  const imgFilename = `${pageNumber}.png`
  do {
    imgB64Data = await contentDiv.$$eval('img', (images, canvWidth, canvHeight, cachedImageSrcs) => {
      if (images.length === 0) return undefined

      let imagesLoaded = true
      for (const img of images) {
        // Check if image is loaded
        if (!img.complete || img.naturalWidth === 0) {
          imagesLoaded = false
          break
        }
      }

      let base64Data = ''

      if (imagesLoaded === true) {
        for (const img of images) {
          if (cachedImageSrcs.includes(img.src) === false) {
            cachedImageSrcs.push(img.src)
          } else {
            return
          }
        }

        // Create virtual canvas
        const canv = document.createElement('canvas')
        canv.setAttribute('id', 'mkCanvas')
        canv.setAttribute('width', canvWidth)
        canv.setAttribute('height', canvHeight)

        // Draw images onto canvas
        const ctx = canv.getContext('2d')
        let y = 0
        for (const img of images) {
          console.log(img.parentNode.style.transform)
          y = parseInt(img.parentNode.style.transform.match(/^translate\(0px, (\d+(\.\d+)?)px\)$/)[1])
          ctx.drawImage(img, 0, y)
        }

        base64Data = canv.toDataURL()
      }
      return base64Data
    }, canvWidth, canvHeight, cachedImageSrcs)

    if (imgB64Data === undefined) {
      logger.verbose(`Waiting for page ${pageNumber} images to load...`)
      // await new Promise((resolve) => setTimeout(resolve, 1000))
      await sleep(1000)
    }
  } while (imgB64Data === undefined)

  if (imgB64Data !== undefined) {
    logger.silly(`imgB64Data: ${imgB64Data}`)
    fs.outputFile(`${sanitize(title)}/${imgFilename}`, imgB64Data.replace(/^data:image\/png;base64,/, ''), 'base64', (err) => {
      if (err) logger.error(err)
    })
  }
}

module.exports = {
  pathnameMatch: (pathname) => pathname.match(/^\/title\/\d+/) !== null,
  initialWaitUntil: 'domcontentloaded',
  initialWaitUntilFn: async (page) => {
    try {
      await page.waitForFunction(() =>
        document.querySelectorAll('div.title_vol_text_box_w > div.title_details_text_section.no_border > h2 > a').length > 0
      , { polling: 'mutation' })
    } catch (err) {
      logger.err(err)
    }
  },
  listParse: (pageContent, url) => ({
    titles: $('div.title_vol_text_box_w > div.title_details_text_section.no_border > h2 > a', pageContent)
      .map((i, elem) => $(elem).text().trim())
      .get(),
    hrefs: $('div.title_vol_btn_box_w > a:nth-child(3)', pageContent)
      .map((i, elem) => `${url.origin}${$(elem).attr('href').trim()}`)
      .get(),
  }),
  download: async (page, href, title) => {
    const startTime = new Date()
    logger.info(`Beginning download of ${title}`)
    await page.goto(href, { waitUntil: 'networkidle0' })
    logger.verbose('Page loaded')

    logger.debug('Looking for tips frame...')
    // Check if tip frame exists and close it
    const tipsFrame = page.frames().find((frame) => frame.name() === 'menu_tips_frame')
    const tipsBtn = await tipsFrame.$('#img_button')
    logger.debug(`tipsBtn: ${tipsBtn}`)
    if (tipsBtn !== null) tipsBtn.click()

    // Begin saving procedure
    await beginSavingProcess(page, title)

    // Output time taken
    logger.info(`Download process finished in ${prettyMs(new Date() - startTime)}`)
  },
}
