const Botkit = require('botkit');
const config = require('config');
const axios = require('axios');

require('dotenv').config();

var controller = Botkit.slackbot({
    debug: false,
    clientSigningSecret: process.env.clientSigningSecret
});
controller.spawn({
    token: process.env.botToken
})
.startRTM(function (err) {
    if (err) {
        throw new Error(err);
    }
});

const options = config.get('SlackClient');

const timeout = ms => new Promise(res => setTimeout(res, ms));

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

function qualifyText(message, text) {
    return text.replace('$user', message.sender.id).replace('$quoteUser', message.quotedMsg && message.quotedMsg.senderId);
}

async function createBotMessage(message) {
    let parsedText = parse(message.text);
    
    let first = parsedText[0].trim();
    let rest = qualifyText(message, parsedText[1]);
    let attachment = null;
    let sender = { id : message.sender.id, name : message.sender.name, shortName : message.sender.shortName, isMe : message.sender.isMe };
    let chat = { id : message.chat.id };
    
    let hasTrigger = options.triggers.includes(first.substr(0, 1));
    let isDirected = false;
    if (!hasTrigger) {
        isDirected = first.substr(-1) == ":" && options.aliases.includes(first.substr(0, first.length - 1));
        if (!isDirected) {
            return;
        }
    }

    /*if (first == "!moment" || first == "!screenshot") {
        if (first === "!moment" && rest.length == 0) {
            this.sendMessage(message.chat.id, 'Specify a name for the recording.');
            return;
        }
        await this.page.evaluate(async (chatId) => {
            let chat = Store.Chat.get(chatId);
            await Store.UiController.openChatBottom(chat);
        }, message.chat.id);
        await timeout(2000);
        await this.sendScreenshot(message.chat.id, first === "!moment" ? `!record ${rest}` : undefined);
        if (message.text == "!moment") {
            await timeout(2000);
            await this.sendMessage(message.chat.id, 'Moment recorded!');
        }
        return;
    }*/

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
        if (hasTrigger) {
            return { text : join(first.substr(1), rest, ' '), sender, chat, attachment };
        }
        else if (isDirected) {
            return { text : join('natural', rest, ' '), sender, chat };
        }
    }

    return null;
}

async function onMessageReceived(bot, message) {
    console.log(`Message from ${message.sender.id}: ${message.text}`);
    
    let botMessage = await createBotMessage(message);
    if (botMessage) {
        console.log(`Sending to bot: ${require('util').inspect(botMessage, {depth:null})}`);
        axios.post(options.message_api_url, botMessage)
        .then(async response => {
            if (response.status == 200) {
                console.log(`Received back: ${require('util').inspect(response.data, {depth:null})}`);
                let data = response.data;
                let text = data.text;                    
                if (data.error) {
                    text = "Error: " + text;
                }                    
                if (data.attachment) {                        
                    if (data.addressee) {
                        text = `${data.addressee}: ` + text + '☝☝';
                    }
                    /*await sendImage(message.chat.id, 
                        data.attachment,
                        text);*/
                }
                else {
                    if (data.addressee) {
                        text = `${data.addressee}: ` + text;
                    }
                    //await sendMessage(message.chat.id, text);
                    bot.reply(message.originalMessage, text);
                }
            }
        })
        .catch(error => {
            console.log(`Error when contacting bot: ${error}`);
        });
    }
}

controller.on(['direct_message', 'ambient'], function (bot, message) {
    console.log(`Received: ${require('util').inspect(message, {depth:null})}`);
    onMessageReceived(bot, {
        originalMessage : message,
        sender : {
            id : message.user,
            userId : message.user,
            //name : message.sender.formattedName,
            //shortName: message.sender.shortName,
            isMe : true
        },
        chat : {
            id : message.channel,
            chatId : message.channel
        },
        type : message.type,
        text : message.text
        //mimeType : message.mimeType,
        //body : message.body,
        //text : message.type === 'chat' ? message.body : message.caption,
        //isGroupMsg : message.isGroupMsg,
        /*quotedMsg : {
            caption : message.quotedMsgObj && message.quotedMsgObj.caption,
            body : message.quotedMsgObj && message.quotedMsgObj.body,
            type : message.quotedMsgObj && message.quotedMsgObj.type,
            mimeType : message.quotedMsgObj && message.quotedMsgObj.mimetype,
            mediaKey : message.quotedMsgObj && message.quotedMsgObj.mediaKey,
            url : message.quotedMsgObj && message.quotedMsgObj.clientUrl,
            filehash : message.quotedMsgObj && message.quotedMsgObj.filehash,
            uploadhash : message.quotedMsgObj && message.quotedMsgObj.uploadhash,
            senderId : message.quotedMsgObj && message.quotedMsgObj.sender.id._serialized
        }*/
    });
});
