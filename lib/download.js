const $ = require('cheerio')
require('cheerio-get-css-selector').init($)
const fs = require('fs')
const inquirer = require('inquirer')
const path = require('path')
const prettyMs = require('pretty-ms')
const puppeteer = require('puppeteer')
const rangeParser = require('parse-numeric-range')
const util = require('util')

const loggerPrefix = require('../utils/logger-prefix')
const sourceHostnames = fs.readdirSync(path.join(__dirname, './sources/'))

module.exports = async (urlString, args) => {
  const loggerLevel = args.silly ? 'silly' : args.debug ? 'debug' : args.verbose ? 'verbose' : 'info'
  const logger = require('../utils/logger')(loggerLevel)

  logger.info(`Processing ${urlString}`)
  logger.silly(`Parsed args: ${util.inspect(args)}`)

  // Check URL
  const url = new URL(urlString)
  if (sourceHostnames.includes(`${url.hostname}.js`) === false) {
    const humanSourceHostnames = sourceHostnames.map((sourceHostName) => sourceHostnames.replace(/\.js$/, '')).join(', ')
    logger.warn(`${url.hostname} is not supported. These are the only available hosts: ${humanSourceHostnames}`)
    return
  }

  // Require URL module
  const urlModule = require('./sources/' + url.hostname)

  // Check for pathname match
  if (urlModule.pathnameMatch(url.pathname) === false) {
    logger.warn(`Host is supported but wrong path (${url.pathname}) was passed.`)
    return
  }

  await (async () => {
    // Launch puppeteer
    logger.verbose('Launching browser...')
    if (args.gui) logger.info('Launching in non-headless mode.')

    // Additional pkg code
    const isPkg = typeof process.pkg !== 'undefined'
    const chromiumExecutablePath = (isPkg
      ? puppeteer.executablePath().replace(
        /^.*?\\node_modules\\puppeteer\\\.local-chromium/,
        path.join(path.dirname(process.execPath), 'chromium')
      )
      : puppeteer.executablePath()
    )
    const browser = await puppeteer.launch({
      headless: !args.gui,
      executablePath: chromiumExecutablePath,
    })

    const page = await browser.newPage()
    // page.setViewport({ width: 1920, height: 1080 })
    if (args.timeout !== 30000) {
      logger.info(`Changed default timeout to ${args.timeout}ms`)
      page.setDefaultTimeout(args.timeout)
    }

    // Set error handler
    process.on('unhandledRejection', (reason, p) => {
      console.error('Unhandled Rejection at: Promise', p, 'reason:', reason)
      browser.close()
    })

    // Load page
    logger.verbose(`Loading main page ${urlString}...`)
    await page.goto(urlString, { waitUntil: urlModule.initialWaitUntil || 'load' })

    if (urlModule.initialWaitUntilFn !== undefined && urlModule.initialWaitUntilFn !== null) {
      await urlModule.initialWaitUntilFn(page)
    }

    // Get titles and hrefs
    const { titles, hrefs } = urlModule.listParse(await page.content(), url)
    logger.info(`Found ${titles.length} titles.`)

    if (titles.length > 0) {
      // Get which to download through prompt
      let downloadIndices = rangeParser.parse(args.item).map((num) => num - 1)
      if (downloadIndices.length === 0) {
        downloadIndices = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'titlesToDownload',
            message: 'Choose which to download',
            prefix: loggerPrefix,
            choices: titles,
          },
        ]).then((answers) => {
          return answers.titlesToDownload.map((title) => titles.indexOf(title))
        })
      } else {
        logger.info(`Auto-selected: ${downloadIndices.map((index) => titles[index]).join('\n')}`)
      }

      // Begin download procedure of selected
      const overallStartTime = new Date()
      for (const downloadIndex of downloadIndices) {
        const title = titles[downloadIndex]
        const href = hrefs[downloadIndex]

        const startTime = new Date()
        logger.verbose(`Beginning download of ${title} at ${href}`)
        await urlModule.download(page, href, title)
        logger.info(`Finished downloading ${title}`)

        // Output time taken
        logger.info(`Download process took ${prettyMs(new Date() - startTime)}`)
      }
      if (downloadIndices.length > 1) {
        logger.info(`Total download process took ${prettyMs(new Date() - overallStartTime)}`)
      }
    }

    logger.verbose('Closing browser...')
    await browser.close()
    logger.verbose('Closed browser.')
  })()
}
