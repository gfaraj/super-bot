var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/ignores.db', autoload: true });

db.ensureIndex({ fieldName: 'senderId' }, function (err) {
});

db.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

export default function(bot) {
    bot.use((bot, message, next) => {
        if (message.sender.isMe) {
            next();            
        }
        else {
            db.findOne({ $or: [{ senderId: message.sender.id }, { chatId: message.chat.id }] }, function (err, doc) {
                if (!doc) {
                    next();
                }
            });
        }
    });

    bot.command('ignore', (bot, message) => {
        if (!message.sender.isMe) {
            bot.error('You don\'t have permission to ignore.');
            return;
        }
        if (message.text.length == 0) {
            bot.error('Please specify the user id to ignore.');
            return;
        }
        db.update({ senderId : message.text }, { senderId : message.text }, { upsert : true }, function () {
            bot.respond(`I'm now ignoring "${message.text}".`);
        });
    });

    bot.command('unignore', (bot, message) => {
        if (!message.sender.isMe) {
            bot.error('You don\'t have permission to unignore.');
            return;
        }
        if (message.text.length == 0) {
            bot.error('Please specify the user id to unignore.');
            return;
        }
        db.remove({ senderId : message.text }, { }, function (err, numRemoved) {
            if (numRemoved > 0) {
                bot.respond(`I'm now listening to "${message.text}".`);
            }
            else {
                bot.error(`I was not ignoring "${message.text}".`);
            }            
        });
    });

    bot.command('silence', (bot, message) => {
        if (!message.sender.isMe) {
            bot.error('You don\'t have permission to silence.');
            return;
        }
        db.update({ chatId : message.chat.id }, { chatId : message.chat.id }, { upsert : true }, function () {
            bot.respond(`I'll be silent here now.`);
        });
    });

    bot.command('unsilence', (bot, message) => {
        if (!message.sender.isMe) {
            bot.error('You don\'t have permission to silence.');
            return;
        }
        db.remove({ chatId : message.chat.id }, { }, function (err, numRemoved) {
            if (numRemoved > 0) {
                bot.respond(`I'm now listening here.`);
            }
            else {
                bot.error(`I was not silent here.`);
            }
        });
    });
}
