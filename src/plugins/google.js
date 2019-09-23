const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');
const google_search_url = 'http://www.google.com/search?';
const max_results = 2;
const puppeteer = require('puppeteer');

var browser;

function extractGoogleResultsFinal(body) {
    var results = [];
    var $ = cheerio.load(body);

    $('#main > div > div > div > a').each(function(i, elem) {
        if (results.length < max_results) {
            var item = {};

            var elemUrl = $(this);
            var elemDesc = $(this).find('div');
            var url = elemUrl.attr("href");
            var parsedUrl = require('url').parse(url, true);
            if (parsedUrl.pathname === '/url') {
                item['url'] = parsedUrl.query.q;
            }
            else {
                item['url'] = url;
            }
            item['title'] = elemDesc.text();

            results.push(item);
        }
    });    

    return results;
}

const DEFAULT_CHROMIUM_ARGS = [
    "--disable-gpu",
    "--renderer",
    "--no-sandbox",
    "--no-service-autorun",
    "--no-experiments",
    "--no-default-browser-check",
    "--disable-webgl",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--disable-in-process-stack-traces",
    "--disable-histogram-customizer",
    "--disable-gl-extensions",
    "--disable-extensions",
    "--disable-composited-antialiasing",
    "--disable-canvas-aa",
    "--disable-3d-apis",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-jpeg-decoding",
    "--disable-accelerated-mjpeg-decode",
    "--disable-app-list-dismiss-on-blur",
    "--disable-accelerated-video-decode",
    "--num-raster-threads=1",
];

async function extractGoogleResults(body) {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: DEFAULT_CHROMIUM_ARGS,
            ignoreHTTPSErrors: true,
            devtools: false,
            defaultViewport: null
        });
    }

    await browser.pages();

    let page = await browser.newPage();
    await page.setContent(body, { waitUntil: 'networkidle0'});

    return extractGoogleResultsFinal(await page.content());
}

function handleGoogle(bot, message) {
    let params = {
        hl : 'en',
        q : message.text,
        start : 0,
        num : max_results
    };
    axios.get(google_search_url + querystring.stringify(params))
    .then(async response => {
        let results = await extractGoogleResults(response.data);
        let resultText = '';
        results.forEach((r, i) => {
            resultText += `${i+1}) ${r.url}\n`;
        });        
        bot.respond(resultText.length == 0 ? 'I didn\'t find anything' : resultText);
    })
    .catch(error => {
        bot.error(`Sorry, I\'m having trouble contacting Google right now. ${error}`);
    });
}

export default function(bot) {
    bot.command('google', handleGoogle);
}
