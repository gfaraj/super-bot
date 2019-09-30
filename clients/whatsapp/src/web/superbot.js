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
WAPI.waitNewMessages(false, (data) => {
    if (!data || !(data instanceof Array)) return;

    data.forEach((message) => {
        console.log(message);

        if (message.type === 'chat') {
            if (message.quotedMsgObj && (message.quotedMsgObj.type === "sticker" || message.quotedMsgObj.type === "image")) {
                let maxWaitCount = 8;
                let imageWaitInterval = setInterval(function() {
                    if (maxWaitCount <= 0) {
                        clearInterval(imageWaitInterval);
                        return;
                    }
                    maxWaitCount--;
                    WAPI.getMessageById(message.quotedMsgObj.id, async (m) => {
                        console.log(m);
                        if (m && m.mediaData.mediaStage === 'RESOLVED') {
                            clearInterval(imageWaitInterval);
                            if (m.mediaData.mediaBlob) {
                                getBase64ImageData(m.mediaData.mediaBlob._blob, (data) => {
                                    WAPI.getMessageById(message.id, (m2) => {
                                        m2.quotedMsgObj.body = data;
                                        processMessage(m2);
                                    });
                                });
                            }
                            else if (m.type == "sticker") {
                                WAPI.getMessageById(message.id, (m2) => {
                                    processMessage(m2);
                                });
                            }
                            else {
                                window.WAPI.downloadFileAndDecrypt({ url: m.clientUrl, type: m.type, mediaKey: m.mediaKey, mimetype: m.mimetype }, (data) => {
                                    WAPI.getMessageById(message.id, (m2) => {
                                        m2.quotedMsgObj.body = data.result;
                                        processMessage(m2);
                                    });
                                });
                            }
                        }
                        else {
                            let chat = Store.Chat.get(message.chatId);
                            await Store.UiController.openChatBottom(chat);
                            await chat.loadEarlierMsgs();
                            if (m) {
                                Store.UiController.scrollToPtt(m);
                            }
                        }
                    });
                }, 3000);
            }
            else {
                processMessage(message);
            }
        }
        else if (message.type === 'image' && message.caption && message.caption.length > 0) {
            Store.UiController.openChatBottom(Store.Chat.get(message.chat.id._serialized));
            let maxWaitCount = 8;
            let imageWaitInterval = setInterval(function() {
                if (maxWaitCount <= 0) {
                    clearInterval(imageWaitInterval);
                    return;
                }
                maxWaitCount--;
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