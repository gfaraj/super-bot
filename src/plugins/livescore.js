const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');
//const livescore_url = 'https://livescore.com';
const livescore_url = 'http://www.livescores.com/';
const puppeteer = require('puppeteer');

var browser;

function extractLiveScoreFinal(body, searchTerm) {
    return new Promise(function (resolve, reject) {        
        const $ = cheerio.load(body);
        const searchTermLower = searchTerm.toLowerCase();

        //$('a.match-row').each(function(i, elem) {
        $('.content > .row-gray').each(function(i, elem) {
            let text = $(this).text();
            if (text.toLowerCase().includes(searchTermLower)) {
                resolve(text.replace('\n', ' '));
                return false;
            }
        });    

        resolve(null);
    });
}

const DEFAULT_CHROMIUM_ARGS = [
    //"--disable-gpu",
    "--renderer",
    "--no-sandbox",
    "--no-service-autorun",
    "--no-experiments",
    "--no-default-browser-check",
    //"--disable-webgl",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--disable-in-process-stack-traces",
    "--disable-histogram-customizer",
    //"--disable-gl-extensions",
    "--disable-extensions",
    "--disable-composited-antialiasing",
    //"--disable-canvas-aa",
    "--disable-3d-apis",
    //"--disable-accelerated-2d-canvas",
    //"--disable-accelerated-jpeg-decoding",
    "--disable-accelerated-mjpeg-decode",
    "--disable-app-list-dismiss-on-blur",
    "--disable-accelerated-video-decode",
    //"--num-raster-threads=1",
];

async function extractLiveScore(body, searchTerm, callback) {
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

    return await callback(await page.content());
}

function handleLiveScore(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a team name!');
        return;
    }
    axios.get(livescore_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36' } 
    })
    .then(async response => {
        //let result = await extractLiveScore(response.data, searchTerm, extractLiveScoreFinal);
        let result = await extractLiveScoreFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    })
    .catch(error => {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    });
}

export default function(bot) {
    bot.command('livescore', handleLiveScore);
}
