const $ = require('cheerio')
require('cheerio-get-css-selector').init($)
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const util = require('util')
const rangeParser = require('parse-numeric-range')
const inquirer = require('inquirer')
const puppeteer = require('puppeteer')

const logger = require('./../utils/logger')

const sourceHostnames = fs.readdirSync(path.join(__dirname, './sources/'))

module.exports = async (urlString, args) => {
  // Check for parameters
  if (args.silly === true) {
    logger.level = 'silly'
    logger.transports.forEach((transpo) => { transpo.level = 'silly' })
    logger.info('Logging in silly mode. Good luck')
  } else if (args.debug === true) {
    logger.level = 'debug'
    logger.transports.forEach((transpo) => { transpo.level = 'debug' })
    logger.info('Logging in debug mode.')
  } else if (args.verbose === true) {
    logger.level = 'verbose'
    logger.transports.forEach((transpo) => { transpo.level = 'verbose' })
    logger.info('Logging in verbose mode.')
  }

  logger.info(`Processing ${urlString}`)
  logger.silly(`Parsed args: ${util.inspect(args)}`)

  // Check URL
  const url = new URL(urlString)
  if (sourceHostnames.includes(`${url.hostname}.js`) === false) {
    logger.warn(`${url.hostname} is not supported. These are the only available hosts: ${sourceHostnames.join(', ')}`)
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

    if (urlModule.initialWaitUntilFn !== undefined) await urlModule.initialWaitUntilFn(page)

    // Get titles and hrefs
    const { titles, hrefs } = urlModule.listParse(await page.content(), url)
    logger.info(`Found ${titles.length} titles.`)

    if (titles.length > 0) {
      // Get which to download through prompt
      let downloadIndices = rangeParser.parse(args.item).map((num) => num - 1)
      if (downloadIndices.length === 0) {
        downloadIndices = await inquirer.prompt([{
          type: 'checkbox',
          name: 'titlesToDownload',
          message: 'Choose which to download',
          prefix: `[${chalk.magenta('Mitekosuru')}]`,
          choices: titles,
        }]).then((answers) => {
          return answers.titlesToDownload.map((title) => titles.indexOf(title))
        })
      } else {
        logger.info(`Auto-selected: ${downloadIndices.map((index) => titles[index]).join('\n')}`)
      }

      // Begin download procedure of selected
      for (const downloadIndex of downloadIndices) {
        const title = titles[downloadIndex]
        const href = hrefs[downloadIndex]
        logger.verbose(`Loading ${title} at ${href}`)
        await urlModule.download(page, href, title)
        logger.info(`Finished downloading ${title}`)
      }
    }

    logger.verbose('Closing browser...')
    await browser.close()
    logger.verbose('Closed browser.')
  })()
}
