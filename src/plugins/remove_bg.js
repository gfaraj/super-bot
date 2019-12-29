const axios = require('axios');
const crawl_url = 'https://www.remove.bg/upload';
const puppeteer = require('puppeteer-extra');

const pluginStealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(pluginStealth());

const pluginRecaptcha = require('puppeteer-extra-plugin-recaptcha');
puppeteer.use(pluginRecaptcha({
    provider: {id: '2captcha', token: process.env.CAPTCHA_SOLVER_TOKEN}, 
    visualFeedback: true
}));

var browser;

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

var uniqueId = 0;

async function saveImageToFile(image) {
    return new Promise((resolve, reject) => {
        let data = image.data.split(',')[1];
        let fileName = require("path").join(process.cwd(), `./temp/removebg-work-${uniqueId++}.jpg`);
        if (uniqueId > 10000) {
            uniqueId = 0;
        }
        require("fs").writeFile(fileName, data, 'base64', function(err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(fileName);
            }
          });
    });
}

async function getImageData(url) {
    var res = await axios.get(url, { responseType: 'arraybuffer' });
    let data = Buffer.from(res.data, 'binary').toString('base64');
    let mimetype = res.headers['content-type'];
    let image = { 
        data: `data:${mimetype};base64,${data}`,
        type: 'image',
        mimetype: mimetype
    };
    return image;
}


async function removeImageBackground(image) {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            userDataDir: "./temp/rb_user_data",
            args: DEFAULT_CHROMIUM_ARGS,
            ignoreHTTPSErrors: true,
            devtools: false,
            defaultViewport: null
        });
    }

    await browser.pages();

    let page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36');
    await page.setBypassCSP(true);
    await page.goto(crawl_url, {
        waitUntil: 'networkidle0',
        timeout: 0
    });

    await page.waitFor('button.btn-primary.btn-lg', {timeout: 8000});

    let imageFileName = await saveImageToFile(image);

    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('button.btn-primary.btn-lg'),
    ]);
    await fileChooser.accept([imageFileName]);

    await page.waitFor(3000);

    const { captchas, solutions, solved, error } = await page.solveRecaptchas();

    if (error && error.length > 0) {
        return null;
    }

    await page.waitFor('div.image-result a.btn-primary', {timeout: 100000});

    try {
        const imageUrl = await page.$eval('div.image-result a.btn-primary', a => a.getAttribute('href'));
        return await getImageData(imageUrl);
    }
    finally {
        require("fs").unlink(imageFileName, (err) => {});

        await page.click('a.btn.image-result--delete-btn');

        await page.waitFor(3000);

        await page.close();
    }
}

async function handleRemoveBg(bot, message) {
    if (!message.attachment) {
        bot.error('No image provided!');
        return;
    }
    try {
        let result = await removeImageBackground(message.attachment);
        if (result) {
            bot.respond(bot.new().attachment(result));
        }
        else {
            bot.error('I could not process this image.');
        }
    }
    catch (error) {
        console.log(error.stack);
        bot.error('I could not process this image at this time.');
    }
}

export default function(bot) {
    bot.command('rembg', handleRemoveBg);
}
