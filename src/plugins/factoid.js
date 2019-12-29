var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/factoid.db', autoload: true });

db.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

function handleFactoid(bot, message) {
    if (message.text.length == 0) {
        db.count({ chatId : message.chat.id }, function (err, count) {
            if (count === 0) {
                bot.error('There are no factoids here.');
                return;
            }

            let index = Math.floor(Math.random() * Math.floor(count));
            
            db.find({ chatId : message.chat.id })
                .skip(index)
                .limit(1)
                .exec(function (err, docs) {
                    if (err || docs.length === 0) {
                        bot.error('I could not retrieve a factoid.');
                        return;
                    }
                    let doc = docs[0];
                    bot.respond({ text : doc.text, attachment : doc.attachment });
                });
        });
    }
    else {
        let doc = {
            chatId : message.chat.id,
            authorId: message.sender.id,
            text : message.text,
            attachment : message.attachment
        };
        db.insert(doc, function () {
            bot.respond(`I've recorded your factoid.`);
        });
    }
}


export default function(bot) {
    bot.command('factoid', handleFactoid);
}
