const crawl_url = 'https://ideone.com';
const puppeteer = require('puppeteer-extra');
const path = require('path');

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

async function runCode(language, codeText) {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            userDataDir: path.resolve("./temp/code_user_data"),
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

    await page.waitFor('#Submit', {timeout: 8000});

    try {
        const languageId = await page.$eval(`#lang-dropdown-menu a[data-label^="${language}" i]`, a => a.getAttribute('data-id'));

        if (!languageId) {
            throw "Unsupported language specified!";
        }

        const setInputValue = async (selector, value) => {
            await page.waitFor(selector);
            await page.evaluate((data) => {
                return document.querySelector(data.selector).value = data.value;
            }, {selector, value});
        };

        let isSyntaxVisible = await page.$eval('label[for="syntax"]', elem => {
            return window.getComputedStyle(elem).getPropertyValue('display') !== 'none' && !!elem.offsetHeight;
        });

        if (!isSyntaxVisible) {
            await page.click('#button-more-options');
            await page.waitFor(1500);
        }

        const isSyntaxChecked = await page.$eval('#syntax', elem => {
            return elem.checked;
        });

        isSyntaxVisible = await page.$eval('label[for="syntax"]', elem => {
            return window.getComputedStyle(elem).getPropertyValue('display') !== 'none' && elem.offsetHeight;
        });

        if (isSyntaxChecked) {
            await page.click('label[for="syntax"]');
            await page.waitFor(500);
        }

        await setInputValue('#_lang', languageId);
        await setInputValue('#file', codeText);

        await page.click('#Submit');

        const statusElement = await page.waitForSelector('#view_status .info.green, #view_status .info.red');

        if (await page.evaluate(e => e.classList.contains("red"), statusElement)) {
            const errorText = await page.$eval('#view_cmperr_content', e => e.textContent);
            return errorText || 'Unknown build error encountered.';
        }

        await page.waitFor('#output-text', {timeout: 8000});
        
        const output = await page.$eval('#output-text', e => e.textContent);
        return output;
    }
    finally {
        await page.close();
    }
}

function autoDetectLanguageFromAttachment(attachment) {
    if (attachment.filetype) {
        switch (attachment.filetype) {
            case "csharp": return "c#";
            case "cpp": return "c++";
        }
    }
    return null;
}

async function handleCode(bot, message, language) {
    let text = message.text.trim();

    if (!language && text.startsWith('-l')) {
        const split = text.replace(/\s+/, '\x01').split('\x01');
        language = split[0].substring(2);
        if (split.length > 1) {
            text = split[1].trim();
        }
    }

    if (!text && message.attachment) {
        if (message.attachment) {
            let dataSplit = message.attachment.data.split(',');
            let mimetype  = dataSplit[0].match(/:(.*?);/)[1];
            let data = dataSplit[1];

            if (!mimetype.startsWith('text')) {
                bot.error('The attachment is not valid code!');
                return;
            }

            text = atob(data);

            if (!language) {
                language = autoDetectLanguageFromAttachment(message.attachment);
            }
        }
    }

    if (!text) {
        bot.error('Please specify the code to run!');
        return;
    }

    if (!language) {
        bot.error('Please specify a programming language!');
        return;
    }

    try {
        let result = await runCode(language, text);
        if (result) {
            bot.respond(bot.new().text(result));
        }
        else {
            bot.error('I could not run this code.');
        }
    }
    catch (error) {
        console.log(error.stack);
        bot.error('I could not run this code at this time.');
    }
}

export default function(bot) {
    bot.command('code', handleCode);
    bot.command('cs', (bot, message) => handleCode(bot, message, 'c#'));
    bot.command('c++', (bot, message) => handleCode(bot, message, 'c++'));
}
