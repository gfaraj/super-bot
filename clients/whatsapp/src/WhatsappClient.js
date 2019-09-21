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

function join(str1, str2, delim) {
    if (str1.length == 0) {
        return str2;
    }
    else if (str2.length == 0) {
        return str1;
    }
    else {
        return str1 + delim + str2;
    }
}

export default class WhatsappClient {
    
    constructor(options) {
        this.options = options;
    }

    async getWhatsappPage() {
        let pages = await this.browser.pages();
        for (let i = 0; i < pages.length; ++i) {
            await pages[i].close();
        }

        let page = await this.browser.newPage();        
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36');
        await page.setBypassCSP(true);
        await page.goto(WHATSAPP_WEB_URL, {
            waitUntil: 'load',
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
                    
        var filepath = path.join(__dirname, 'web/wapi.js');
        await this.page.addScriptTag({ path: filepath, type: 'text/javascript' });
        //await this.page.evaluate(require('fs').readFileSync(filepath, 'utf8'));

        //const timeout = ms => new Promise(res => setTimeout(res, ms));
        //await timeout(2000);

        await this.page.exposeFunction('onMessageReceived', (message) => {
            this.onMessageReceived(message);
        });

        await this.page.evaluate(() => {
            function getBase64ImageData(blob, callback) {
                var reader = new FileReader();
                reader.readAsDataURL(blob); 
                reader.onloadend = function() {
                    callback(reader.result);
                }
            }
            function processMessage(message) {
                window.onMessageReceived({
                    sender : {
                        id : message.sender.id._serialized,
                        userId : message.sender.id.user,
                        name : message.sender.formattedName,
                        shortName: message.sender.shortName,
                        isMe : message.sender.isMe
                    },
                    chat : {
                        id : message.chat.id._serialized,
                        chatId : message.chat.id.user,
                        isGroup : message.chat.isGroup
                    },
                    type : message.type,
                    mimeType : message.mimeType,
                    body : message.body,
                    text : message.type == 'chat' ? message.body : message.caption,
                    isGroupMsg : message.isGroupMsg,
                    quotedMsg : {
                        caption : message.quotedMsgObj && message.quotedMsgObj.caption,
                        body : message.quotedMsgObj && message.quotedMsgObj.body,
                        type : message.quotedMsgObj && message.quotedMsgObj.type,
                        mimeType : message.quotedMsgObj && message.quotedMsgObj.mimetype,
                        mediaKey : message.quotedMsgObj && message.quotedMsgObj.mediaKey,
                        url : message.quotedMsgObj && message.quotedMsgObj.clientUrl,
                        filehash : message.quotedMsgObj && message.quotedMsgObj.filehash,
                        uploadhash : message.quotedMsgObj && message.quotedMsgObj.uploadhash
                    }
                });
            }
            WAPI.waitNewMessages(false, (data) => {
                data.forEach((message) => {
                    console.log(message);

                    if (message.type == 'chat') {
                        if (message.quotedMsgObj && (message.quotedMsgObj.type == "sticker" || message.quotedMsgObj.type == "image")) {
                            let imageWaitInterval = setInterval(function() {                            
                                WAPI.getMessageById(message.quotedMsgObj.id, (m) => {
                                    console.log(m);
                                    if (!m) {
                                        let chat = Store.Chat.get(message.chatId);
                                        Store.UiController.openChatBottom(chat);
                                        chat.loadEarlierMsgs();
                                    }
                                    else if (m.mediaData.mediaStage === 'RESOLVED') {
                                        clearInterval(imageWaitInterval);
                                        getBase64ImageData(m.mediaData.mediaBlob._blob, (data) => {
                                            WAPI.getMessageById(message.id, (m2) => {
                                                m2.quotedMsgObj.body = data;
                                                processMessage(m2);
                                            });
                                        });
                                    }
                                });
                            }, 3000);
                        }
                        else {
                            processMessage(message);
                        }
                    }
                    else if (message.type == 'image' && message.caption && message.caption.length > 0) {
                        Store.UiController.openChatBottom(Store.Chat.get(message.chat.id._serialized));
                        let imageWaitInterval = setInterval(function() {
                            WAPI.getMessageById(message.id, (m) => {
                                console.log(m);
                                if (!m) {
                                    clearInterval(imageWaitInterval);
                                }
                                else if (m.mediaData.mediaStage === 'RESOLVED') {
                                    clearInterval(imageWaitInterval);
                                    getBase64ImageData(m.mediaData.mediaBlob._blob, (data) => {
                                        m.body = data;
                                        processMessage(m);
                                    });                                    
                                }
                            });
                        }, 3000);
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

    getImageFileExtension(image) {
        if (image.type == "sticker" || image.mimeType == 'image/webp') {
            return 'webp';
        }
        else {
            return 'jpg';
        }
    }

    async sendImage(to, image, caption) {
        if (image.type == "sticker" || image.mimeType == 'image/webp') {
            await this.page.evaluate((to, image) => {
                WAPI.sendSticker({ sticker: image, chatid: to }, (result) => {
                    console.log(`Send sticker to ${to} result = ${result}`);
                });
            }, to, image);
        }
        else {
            let imageFileName = `test.${this.getImageFileExtension(image)}`;
            await this.page.evaluate((to, image, imageFileName, caption) => {
                WAPI.sendImage(`${image.data}`, to, imageFileName, caption, (result) => {
                    console.log(`Send image to ${to} result = ${result}`);
                });
            }, to, image, imageFileName, caption);
        }
    }

    createBotMessage(message) {
        let parsedText = parse(message.text);
        
        let first = parsedText[0].trim();
        let rest = parsedText[1];
        let attachment = null
        let sender = { id : message.sender.id, name : message.sender.name, shortName : message.sender.shortName, isMe : message.sender.isMe }
        let chat = { id : message.chat.id }

        if (message.type == "image") {
            attachment = { data : message.body, mimeType : message.mimeType, type : message.type };
        }
        else if (message.quotedMsg) {
            if (message.quotedMsg.type == "chat") {
                rest = join(rest, message.quotedMsg.body, ' ');
            }
            else if (message.quotedMsg.caption) {
                rest = join(rest, message.quotedMsg.caption, ' ');
            }

            if (message.quotedMsg.type == "image" || message.quotedMsg.type == "sticker") {
                attachment = { data : message.quotedMsg.body, mimeType : message.quotedMsg.mimeType, type : message.quotedMsg.type };
                if (message.quotedMsg.type == "sticker") {
                    attachment.url = message.quotedMsg.url;
                    attachment.mediaKey = message.quotedMsg.mediaKey;
                    attachment.filehash = message.quotedMsg.filehash;
                    attachment.uploadhash = message.quotedMsg.uploadhash;
                }
            }
        }

        if (first.length > 0) {
            if (this.options.triggers.includes(first.substr(0, 1))) {
                return { text : join(first.substr(1), rest, ' '), sender, chat, attachment };
            }
            else if (first.substr(-1) == ":" && this.options.aliases.includes(first.substr(0, first.length - 1))) {
                return { text : join('natural', rest, ' '), sender, chat };
            }
        }

        return null;
    }

    async onMessageReceived(message) {
        console.log(`Message from ${message.sender.name}: ${message.text}`);
        
        let botMessage = this.createBotMessage(message);
        if (botMessage) {
            console.log(`Sending to bot: ${require('util').inspect(botMessage, {depth:null})}`);
            axios.post(this.options.message_api_url, botMessage)
            .then(async response => {
                if (response.status == 200) {
                    console.log(`Received back: ${require('util').inspect(response.data, {depth:null})}`);
                    let data = response.data;
                    let text = data.text;
                    if (data.error) {
                        text = "Error: " + data.message;
                    }
                    if (data.attachment) {
                        await this.sendImage(message.chat.id, 
                            data.attachment,
                            text);
                    }
                    else {
                        await this.sendMessage(message.chat.id, text);
                    }
                }
            })
            .catch(error => {
                console.log(`Error when contacting bot: ${error}`);
            });
        }
    }
}