const Botkit = require('botkit');
const config = require('config');
const axios = require('axios');
const fs = require("fs");
const stream = require("stream");

require('dotenv').config();

const controller = Botkit.slackbot({
    debug: false,
    clientSigningSecret: process.env.clientSigningSecret
});
const bot = controller.spawn({
    token: process.env.botToken
});

function startRTM() {
    console.log(`Starting RTM connection...`);

    bot.startRTM(function (err) {
        if (err) {
            console.log(`Failed to start RTM, error = ${err}`);
            console.log(`Retrying in 6 seconds...`);
            setTimeout(startRTM, 6000);
        }
        else {
            console.log(`RTM connection started.`);
        }
    })
}
startRTM();

controller.on('rtm_close', () => {
    startRTM();
});

const slackRequestAdapter = axios.create({
   headers: {
       Authorization: `Bearer ${process.env.botToken}`
   }
});

const options = config.get('SlackClient');

const callbackUrl = 'http://localhost:3002/message'

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

function inspectMessage(msg) {
    return JSON.stringify(msg, function (key, value) {
        if (key === 'data' && typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '[...]';
        }
        return value;
    });
}

function qualifyText(message, text) {
    return text.replace('$user', message.sender.id).replace('$quoteUser', message.quotedMsg && message.quotedMsg.senderId);
}

async function slackFileToAttachment(file) {
    let response = await slackRequestAdapter.get(file.url_private_download, {
        responseType: 'arraybuffer'
    });
    let data = Buffer.from(response.data, 'binary').toString('base64');
    return {
        data: `data:${file.mimetype};base64,${data}`,
        mimeType: file.mimetype,
        fileType: file.filetype
    }
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
            return null;
        }
    }

    if (message.files && message.files.length > 0) {
        attachment = await slackFileToAttachment(message.files[0]);
    }
    else if (message.attachments && message.attachments.length > 0) {
        //TODO: handle quoted messages
    }
    else if (message.parent) {
        rest = join(rest, message.parent.text, ' ');
        if (message.parent.files && message.parent.files.length > 0) {
            attachment = await slackFileToAttachment(message.parent.files[0]);
        }
    }

    if (first.length > 0) {
        if (hasTrigger) {
            return { text : join(first.substr(1), rest, ' '), sender, chat, attachment };
        }
        else if (isDirected) {
            return { text : join('natural', rest, ' '), sender, chat, attachment };
        }
    }

    return null;
}

async function sendTextMessage(channel, text, source) {
    let message = {
        channel,
        text,
    };

    if (source && source.thread_ts) {
        bot.replyInThread(source.originalMessage, message);
    }
    else {
        bot.say(message);
    }
}

let uniqueFileId = 0;

async function saveFileToDisk(file) {
    return new Promise((resolve, reject) => {
        let data = file.data.split(',')[1];
        let fileName = require("path").join(process.cwd(), `./temp/slack-work-${uniqueFileId++}.${file.fileType}`);
        if (uniqueFileId > 10000) {
            uniqueFileId = 0;
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

async function uploadFile(file) {
    let fileName = await saveFileToDisk(file);

    return new Promise((resolve, reject) => {
        bot.api.files.upload({
            token: process.env.botToken,
            filename: `file.${file.fileType || 'png'}`,
            filetype: "auto",
            file: fs.createReadStream(fileName)
        }, (err, response) => {
            require("fs").unlink(fileName, (err) => {});
            if (err) {
                reject(err);
            }
            else {
                resolve(response.file);
            }
        });
    });
}

async function uploadFileAndPost(channel, file, text, source) {
    let fileName = await saveFileToDisk(file);

    return new Promise((resolve, reject) => {
        let options = {
            token: process.env.botToken,
            filename: `file.${file.fileType || 'png'}`,
            filetype: "auto",
            channels: channel,            
            initial_comment: text,
            file: fs.createReadStream(fileName)
        };
        if (source && source.thread_ts) {
            options.thread_ts = source.thread_ts;
        }
        
        bot.api.files.upload(options, (err, response) => {
            require("fs").unlink(fileName, (err) => {});
            if (err) {
                reject(err);
            }
            else {
                resolve(response.file);
            }
        });
    });
}



async function sendFile(channel, file, text, source) {
    //let fileSpec = await uploadFile(file);

    await uploadFileAndPost(channel, file, text, source);
    /*bot.say({
        channel,
        text,
        attachments: [
            {
                contentType: fileSpec.mimetype,
                contentUrl: fileSpec.url_private_download,
                name: `file.${fileSpec.filetype}`
            }
        ]
    });*/
}

function retrieveParentMessage(message) {
    return new Promise((resolve, reject) => {
        bot.api.conversations.history({
            token: process.env.userToken,
            channel: message.channel,
            latest: message.thread_ts,
            limit: 1,
            inclusive: true
        }, (err, response) => {
            if (err) {
                console.log(err);
                resolve(null);
            }
            else {
                resolve(response.messages[0]);
            }
        });
    });
}

async function onBotMessageReceived(message, source) {
    let text = message.text || '';
    if (message.error) {
        text = "Error: " + text;
    }                    
    if (message.attachment) {                        
        if (message.addressee) {
            text = `${message.addressee}: ` + text + '☝☝';
        }
        await sendFile(message.chat.id, message.attachment, text, source);
    }
    else {
        if (message.addressee) {
            text = `${message.addressee}: ` + text;
        }
        await sendTextMessage(message.chat.id, text, source);
    }
}

async function onMessageReceived(bot, message) {
    console.log(`Message from ${message.sender.id}: ${message.text}`);
    
    try {
        let botMessage = await createBotMessage(message);
        if (botMessage) {
            botMessage.callbackUrl = callbackUrl;

            console.log(`Sending to bot: ${inspectMessage(botMessage)}`);
            let response = await axios.post(options.message_api_url, botMessage);
            
            if (response.status == 200) {
                console.log(`Received back: ${inspectMessage(response.data)}`);
                let data = response.data;
                if (!data.chat || !data.chat.id) {
                    data.chat = { id: message.chat.id };
                }

                await onBotMessageReceived(data, message);
            }
            else {
                console.log(`Could not contact bot.`);
                await sendTextMessage(message.chat.id, 'Error: could not contact bot.', message);
            }
        }
    }
    catch(error) {
        console.log(`Error when contacting bot: ${error}`, error.stack);
        await sendTextMessage(message.chat.id, 'Error: could not contact bot.', message);
    }
}

controller.on(['direct_message', 'ambient'], async function (bot, message) {
    console.log(`Received: ${inspectMessage(message)}`);
    
    try {
        await onMessageReceived(bot, {
            originalMessage: message,
            sender : {
                id: message.user,
                userId: message.user,
                //name : message.sender.formattedName,
                //shortName: message.sender.shortName,
                isMe: true
            },
            chat: {
                id: message.channel,
                chatId: message.channel
            },
            type: message.type,
            text: message.text,
            thread_ts: message.thread_ts,
            attachments: message.attachments,
            files: message.files,
            parent: message.thread_ts && message.thread_ts != message.ts ? await retrieveParentMessage(message) : undefined
        });
    }
    catch(error) {
        console.log(`Error when parsing slack message: ${error}`, error.stack);
        await sendTextMessage(message.channel, 'Error: could not parse Slack message.', message);
    }
});
