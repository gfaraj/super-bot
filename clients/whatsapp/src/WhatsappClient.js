const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');


const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';
const DEFAULT_CHROMIUM_ARGS = [
    `--app=${WHATSAPP_WEB_URL}`,
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

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

export default class WhatsappClient {
    
    constructor(options) {
        this.options = options;
    }

    async getWhatsappPage() {
        let pages = await this.browser.pages();
        for (let i = 0; i < pages.length; ++i) {
            pages[i].close();
        }

        let page = await this.browser.newPage();
        page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36");
        await page.goto(WHATSAPP_WEB_URL, {
            waitUntil: 'networkidle0',
            timeout: 0
        });
        return page;
    }

    async start() {
        this.browser = await puppeteer.launch({
            headless: false,
            userDataDir: "./user_data",
            args: DEFAULT_CHROMIUM_ARGS,
            ignoreHTTPSErrors: true,
            devtools: false
        });
        
        this.page = await this.getWhatsappPage();
                    
        var filepath = path.join(__dirname, "web/wapi.js");
        await this.page.addScriptTag({ path: require.resolve(filepath) });

        await this.page.exposeFunction('onMessageReceived', (message) => {
            this.onMessageReceived(message);
        });

        await this.page.evaluate(() => {
            WAPI.waitNewMessages(false, (data) => {
                data.forEach((message) => {
                    if (message.type == "chat") {
                        console.log(message);
                        console.log(message.from.user);
                        window.onMessageReceived({
                            sender : {
                                id : message.sender.id._serialized,
                                userId : message.sender.id.user,
                                name : message.sender.name,
                                shortName: message.sender.shortName,
                                isMe : message.sender.isMe
                            },
                            chat : {
                                id : message.chat.id._serialized,
                                chatId : message.chat.id.user,
                                isGroup : message.chat.isGroup
                            },
                            body : message.body,
                            isGroupMsg : message.isGroupMsg
                        });
                    }
                });
            });
        });
    }

    async sendSeen(to) {
        await this.page.evaluate(to => {
            WAPI.sendSeen(to);
        }, to);
    }

    async sendMessage(to, message) {
        await this.page.evaluate((to, message) => {
            WAPI.sendMessage2(to, message, (result) => {
                console.log(`Send message ${message} to ${to} result = ${result}`);
            });
        }, to, message);
    }

    createBotMessage(message) {
        let parsedText = parse(message.body);
        
        let first = parsedText[0].trim();
        if (first.length > 0) {
            if (this.options.triggers.includes(first.substr(0, 1))) {
                return { text : first.substr(1) + ' ' + parsedText[1] };
            }
            else if (first.substr(-1) == ":" && this.options.aliases.includes(first.substr(0, first.length - 1))) {
                return { text : 'natural ' + parsedText[1] };
            }
        }

        return null;
    }

    async onMessageReceived(message) {
        console.log(`Message from ${message.sender.name}: ${message.body}`);
        
        let botMessage = this.createBotMessage(message);
        if (botMessage) {
            axios.post(this.options.message_api_url, botMessage)
            .then(async response => {
                if (response.status == 200) {
                    let data = response.data;
                    let text = data.text;
                    if (data.error) {
                        text = "error: " + data.message;
                    }
                    await this.sendMessage(message.chat.id, text);
                }
            })
            .catch(error => {
                console.log(`Error when contacting bot: ${error}`);
            });
        }
    }
}