const $ = require('cheerio')
require('cheerio-get-css-selector').init($)
const _ = require('lodash')
const fs = require('fs')
const logger = require('./../../utils/logger')

// Sample:
// https://www.cmoa.jp/title/66491/

const beginSavingProcess = async (page) => {
  // Get content divs
  const containerDiv = await page.$('#content')
  // const containerDivBB = await containerDiv.boundingBox()
  const contentDivs = await containerDiv.$$('div[id^=content-p]')

  for (const contentDiv of contentDivs) {
    let pageNumber = (await (await contentDiv.getProperty('id')).jsonValue()).substr(9)
    pageNumber = _.padStart(pageNumber, contentDivs.length.toString().length, '0')
    logger.info(`Downloading page ${pageNumber}...`)

    // Download page
    await downloadContent(contentDiv, pageNumber)

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
}

const downloadContent = async (contentDiv, pageNumber) => {
  const cachedImageSrcs = []
  let imgB64Data

  logger.verbose(`Checking if page ${pageNumber} images are loaded...`)
  const imgFilename = `${pageNumber}.png`
  do {
    imgB64Data = await contentDiv.$$eval('img', (images, cachedImageSrcs) => {
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

        // Download page
        // const pageNumber = parseInt(images[0].parentElement.parentElement.parentElement.id.substr(9))
        // console.log(`Downloading page ${pageNumber}`)

        // Get height and width
        var canvWidth = images[0].width
        var canvHeight = images[0].height
        for (var i = 1; i < images.length; i++) {
          canvHeight += images[i].height
        }

        // Create virtual canvas
        var canv = document.createElement('canvas')
        canv.setAttribute('id', 'mkCanvas')
        canv.setAttribute('width', canvWidth)
        canv.setAttribute('height', canvHeight)

        // Draw images onto canvas
        var ctx = canv.getContext('2d')
        var y = 0
        for (const img of images) {
          ctx.drawImage(img, 0, y)
          y += img.height
        }

        base64Data = canv.toDataURL()
      }
      return base64Data
    }, cachedImageSrcs)

    if (imgB64Data === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  } while (imgB64Data === undefined)

  if (imgB64Data !== undefined) {
    logger.silly(`imgB64Data: ${imgB64Data}`)
    fs.writeFile(imgFilename, imgB64Data.replace(/^data:image\/png;base64,/, ''), 'base64', (err) => {
      if (err) logger.error(err)
    })
  }
}

module.exports = {
  pathnameMatch: (pathname) => pathname.match(/\/title\/\d+\//) !== null,
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
  download: async (page, href) => {
    await page.goto(href, { waitUntil: 'networkidle0' })
    logger.verbose('Page loaded')
    await page.screenshot({
      path: `mtksr-ss.png`,
      fullPage: true,
    })

    // Check if tip frame exists and close it
    const tipsFrame = page.frames().find((frame) => frame.name() === 'menu_tips_frame')
    const tipsBtn = await tipsFrame.$('#img_button')
    logger.debug(`tipsBtn: ${tipsBtn}`)
    if (tipsBtn !== null) tipsBtn.click()

    // Begin saving procedure
    await beginSavingProcess(page)
  },
}
