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
        bot.error('Please specify a name for the recording!');
        return;
    }
    let rest = parsedText[1];
    if (rest.length == 0 && !message.attachment) {
        bot.error('Please specify content for the recording!');
        return;
    }    
    let doc = {
        name : name.toLowerCase(),
        chatId : message.chat.id,
        text : rest,
        attachment : message.attachment
    };
    db.update({ name, chatId : message.chat.id }, doc, { upsert : true }, function () {
        bot.respond(`I've recorded "${name}".`);
    });
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

export default function(bot) {
    bot.command('record', handleRecord);
    bot.raw(handleRaw);
}
