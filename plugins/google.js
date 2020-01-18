const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');
const google_search_url = 'http://www.google.com/search?';
const max_results = 2;
const puppeteer = require('puppeteer');

var browser;

function extractGoogleResultsFinal(body) {
    return new Promise(function (resolve, reject) {
        var results = [];
        var $ = cheerio.load(body);

        $('#main > div > div > div > a').each(function(i, elem) {            
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
            
            if (results.length >= max_results)
                return false;
        });

        resolve(results);
    });
}

async function getImageData(url) {
    var res = await axios.get(url, { responseType: 'arraybuffer' });

    return `data:${res.headers['content-type']};base64,${Buffer.from(String.fromCharCode(...new Uint8Array(res.data)), 'binary')
          .toString('base64')}`;
}

async function extractGoogleImageResultFinal(body) {
    var results;
    var $ = cheerio.load(body);

    $('#search > div > div > div > div > div > div > div > a > img').each(function(i, elem) {
    //$('.images_table img').each(function(i, elem) {
        if (!results) {
            results = $(this).attr('src');
        }
    });

    return new Promise(resolve => {
        resolve(results);
    });

    /*if (results)
        return await getImageData(results);
    return null;*/
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

async function extractGoogleResults(body, callback) {
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

function handleGoogle(bot, message) {
    let params = {
        hl : 'en',
        q : message.text,
        start : 0,
        num : max_results
    };
    axios.get(google_search_url + querystring.stringify(params))
    .then(async response => {
        let results = await extractGoogleResults(response.data, extractGoogleResultsFinal);
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

function handleGoogleImage(bot, message) {
    let params = {
        hl : 'en',
        q : message.text,
        start : 0,
        num : 1,
        tbm : 'isch',
        source : 'lnms',
        sa : 'X',
        biw : 1920,
        bih : 937
    };
    axios.get(google_search_url + querystring.stringify(params), { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36' } 
    })
    .then(async response => {
        let result = await extractGoogleResults(response.data, extractGoogleImageResultFinal);
        bot.respond(!result ? 'I didn\'t find anything' : { attachment: { data: result, mimetype: 'image/jpeg' } });
    })
    .catch(error => {
        bot.error(`Sorry, I\'m having trouble contacting Google right now. ${error}`);
    });
}

export default function(bot) {
    bot.command('google', handleGoogle);
    bot.command('gimg', handleGoogleImage);
}
