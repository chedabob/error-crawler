const axios = require('axios').default;
const xml2js = require('xml2js');
var parser = new xml2js.Parser();
const puppeteer = require('puppeteer');

var myArgs = process.argv.slice(2);
const url = `${myArgs[0]}/sitemap.xml`

/**
 * Navigates to a page in Puppeteer, captures all URLs and console errors
 * @param {Browser} browser Puppeteer browser
 * @param {*} url The URL to navigate to
 * @returns Object containg the page URL, an error of URLs that failed to load, and an array of console errors
 */
async function explorePage(browser, url) {
    console.log(`Exploring ${url}`)

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
        request.continue();
    });  
    // Catch all failed requests like 4xx..5xx status codes
    errorUrls = []
    page.on('requestfinished', request => {
        // errorUrls.push()
        var status = request.response()?.status()
        if (status != null && status >= 400 && status < 500)  {
            var url = request.url()
            errorUrls.push(url)
        }
    });

    pageErrors = []
    // Catch console log errors
    page.on("pageerror", err => {
        // console.log(`Page error: ${err.toString()}`);
        pageErrors.push(err.toString())
    });
    
    // Catch all console messages
    page.on('console', msg => {
        // console.log(msg)
        // console.log('Logger:', msg.type());
        // console.log('Logger:', msg.text());
        // console.log('Logger:', msg.location().url);
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000); 

    return {
        'url' : url,
        'missingUrls' : errorUrls,
        'errors': pageErrors
    }

}


/**
 * Gets all of the URls from a given sitemap
 * @param {string} url The sitemap to extract URLs from  
 * @returns A list of URLs
 */
async function getMapUrls(url) {
    const response = await axios.get(url);
    var xml = await parser.parseStringPromise(response.data)
    return xml.urlset.url.map(x => x.loc[0])
}

(async function () {
    const response = await axios.get(url);

    var xml = await parser.parseStringPromise(response.data);

    var maps = xml.sitemapindex.sitemap.map(x => x.loc[0]);
    var urls = (await Promise.all(maps.map(x => getMapUrls(x)))).flat()
    
    const browser = await puppeteer.launch({
        headless: true
    });

    console.log(`Found ${urls.length} URLs`)

    var errors = []
    for (const url of urls) {
        var result = await explorePage(browser, url)
        errors.push(result)
    }

    browser.close()

    console.log(JSON.stringify(errors))
})();
