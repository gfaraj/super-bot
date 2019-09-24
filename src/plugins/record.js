var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/recording.db', autoload: true });

db.ensureIndex({ fieldName: 'name' }, function (err) {
    // If there was an error, err is not null
});

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

function handleRecord(bot, message) {
    let parsedText = parse(message.text);
    let name = parsedText[0];
    if (name.length == 0) {
        bot.error('Usage: !record <name> <value>');
        return;
    }
    let rest = parsedText[1];
    if (rest.length == 0 && !message.attachment) {
        bot.error('Usage: !record <name> <value>');
        return;
    }
    let doc = {
        name : name.toLowerCase(),
        chatId : message.chat.id,
        authorId: message.sender.id,
        text : rest,
        attachment : message.attachment
    };
    db.update({ name, chatId : message.chat.id }, doc, { upsert : true }, function () {
        bot.respond(`I've recorded "${name}".`);
    });
}

function handleForget(bot, message) {
    let name = message.text;
    if (name.length == 0) {
        bot.error('Usage: !forget <name>');
        return;
    }
    function onRemoveDone(err, numRemoved) {
        if (numRemoved > 0) {
            bot.respond(`I forgot "${name}".`);
        }
        else {
            bot.error(`I don't have the recording "${name}".`);
        }
    }

    if (message.sender.isMe) {
        db.remove({ name, chatId : message.chat.id }, {}, onRemoveDone);
    }
    else {
        db.findOne({ name, chatId : message.chat.id }, { authorId : 1 }, function (err, doc) {
            if (doc) {
                if (!doc.authorId || doc.authorId == message.sender.id) {
                    db.remove(doc, {}, onRemoveDone);
                }
                else {
                    bot.error(`You can't make me forget "${name}". It was recorded by someone else.`);    
                }
            }
            else {
                bot.error(`I don't have the recording "${name}".`);
            }
        });
    }
}

function handleRaw(bot, message) {
    if (message.text.length == 0) {
        return;
    }

    db.findOne({ name : message.text.toLowerCase(), chatId : message.chat.id }, function (err, doc) {
        if (doc) {
            bot.respond({ text : doc.text, attachment : doc.attachment });
        }
    });
}

function handleRecordings(bot, message) {    
    let search = message.text.toLowerCase();
    
    function callback(err, docs) {
        if (docs.length == 0) {
            if (search.length > 0) {
                bot.respond(`There are no recordings that match "${search}".`);
            }
            else {
                bot.respond(`There are no recordings yet.`);
            }
        }
        else {
            bot.respond(docs.map(e => e.name).join(', '));
        }        
    }

    if (search.length > 0) {
        db.find({ chatId : message.chat.id, name : { $regex: new RegExp(search, "g") } }, { name : 1 }).sort({ name : 1 }).exec(callback);
    }
    else {
        db.find({ chatId : message.chat.id }, { name : 1 }).sort({ name : 1 }).exec(callback);
    }
}


export default function(bot) {
    bot.command('record', handleRecord);
    bot.command('forget', handleForget);
    bot.command('recordings', handleRecordings);
    bot.raw(handleRaw);
}
