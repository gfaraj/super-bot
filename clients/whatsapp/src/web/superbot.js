/* ---
Super-bot new message handler.
*/

const timeout = ms => new Promise(res => setTimeout(res, ms));

window.getFileHash = async (data) => {
    let buffer = await data.arrayBuffer();
    var sha = new jsSHA("SHA-256", "ARRAYBUFFER");
    sha.update(buffer);
    return sha.getHash("B64");
};

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
        text : message.type === 'chat' ? message.body : message.caption,
        isGroupMsg : message.isGroupMsg,
        quotedMsg : {
            caption : message.quotedMsgObj && message.quotedMsgObj.caption,
            body : message.quotedMsgObj && message.quotedMsgObj.body,
            type : message.quotedMsgObj && message.quotedMsgObj.type,
            mimeType : message.quotedMsgObj && message.quotedMsgObj.mimetype,
            mediaKey : message.quotedMsgObj && message.quotedMsgObj.mediaKey,
            url : message.quotedMsgObj && message.quotedMsgObj.clientUrl,
            filehash : message.quotedMsgObj && message.quotedMsgObj.filehash,
            uploadhash : message.quotedMsgObj && message.quotedMsgObj.uploadhash,
            senderId : message.quotedMsgObj && message.quotedMsgObj.sender.id._serialized
        }
    });
}

function handleQuotedImage(message) {
    console.log("Processing a quoted image message...");

    let maxWaitCount = 8;
    let uiBusy = false;
    let imageWaitInterval = setInterval(function() {
        if (maxWaitCount <= 0) {
            console.log("Could not resolve the quoted image, tried the maximum number of times.");
            clearInterval(imageWaitInterval);
            return;
        }
        maxWaitCount--;
        WAPI.getMessageById(message.quotedMsgObj.id, async (m) => {
            console.log(m);
            if (m && m.mediaData.mediaStage === 'RESOLVED') {
                console.log("Quoted image resolved...");
                clearInterval(imageWaitInterval);
                if (m.mediaData.mediaBlob) {
                    let data = await window.WAPI.fileToBase64(m.mediaData.mediaBlob._blob);
                    WAPI.getMessageById(message.id, (m2) => {
                        m2.quotedMsgObj.body = data;
                        processMessage(m2);
                    });
                }
                else {
                    let data = await window.WAPI.downloadFileAndDecrypt({ url: m.clientUrl, type: m.type, mediaKey: m.mediaKey, mimetype: m.mimetype });
                    WAPI.getMessageById(message.id, (m2) => {
                        m2.quotedMsgObj.body = data.result;
                        processMessage(m2);
                    });
                }
            }
            else {
                let chat = Store.Chat.get(message.chat.id._serialized);
                if (chat) {
                    await chat.loadEarlierMsgs();
                    await chat.loadEarlierMsgs();

                    let m2 = Store.Msg.get(message.quotedMsgObj.id);
                    if (m2 && m2.clientUrl) {
                        clearInterval(imageWaitInterval);
                        let data = await window.WAPI.downloadFileAndDecrypt({ url: m.clientUrl, type: m.type, mediaKey: m.mediaKey, mimetype: m.mimetype });
                        WAPI.getMessageById(message.id, (m3) => {
                            m3.quotedMsgObj.body = data.result;
                            processMessage(m3);
                        });
                    }
                }
            }
        });
    }, 5000);
}

function handleImageMessage(message) {
    console.log("Processing an image message...");

    let chat = Store.Chat.get(message.chat.id._serialized);
    if (!chat) {
        console.log(`Could not find chat: ${message.chat.id._serialized}`);
        return;
    }

    Store.UiController.openChatBottom(chat);

    let maxWaitCount = 8;
    let imageWaitInterval = setInterval(function() {
        if (maxWaitCount <= 0) {
            console.log("Could not resolve the image, tried the maximum number of times.");
            clearInterval(imageWaitInterval);
            return;
        }
        maxWaitCount--;
        WAPI.getMessageById(message.id, async (m) => {
            console.log(m);
            if (!m) {
                console.log("Could not find message, aborting...");
                clearInterval(imageWaitInterval);
            }
            else if (m.mediaData.mediaStage === 'RESOLVED') {
                console.log("Image resolved...");
                clearInterval(imageWaitInterval);
                if (m.mediaData.mediaBlob) {
                    let data = await window.WAPI.fileToBase64(m.mediaData.mediaBlob._blob);
                    m.body = data;
                    processMessage(m);
                }
                else {
                    let data = await window.WAPI.downloadFileAndDecrypt({ url: m.clientUrl, type: m.type, mediaKey: m.mediaKey, mimetype: m.mimetype });
                    WAPI.getMessageById(message.id, (m2) => {
                        m2.body = data.result;
                        processMessage(m2);
                    });
                }
            }
        });
    }, 3000);
}

WAPI.waitNewMessages(false, (data) => {
    if (!data || !(data instanceof Array)) return;

    data.forEach((message) => {
        console.log(message);

        if (message.type === 'chat') {
            if (message.quotedMsgObj && (message.quotedMsgObj.type === "sticker" || message.quotedMsgObj.type === "image")) {
                handleQuotedImage(message);
            }
            else {
                processMessage(message);
            }
        }
        else if (message.type === 'image' && message.caption && message.caption.length > 0) {
            handleImageMessage(message);
        }
    });
});