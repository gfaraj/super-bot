var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/posers.db', autoload: true });

db.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

export function findPoser(chatId) {
    return new Promise((resolve, reject) => {
        db.findOne({ chatId }, function (err, doc) {
            resolve(doc);
        });
    });
}

export default function(bot) {
    bot.use(async (bot, message, next) => {
        let poser = await findPoser(message.chat.id);
        if (poser) {
            message.chat.realId = message.chat.id;
            message.chat.id = poser.posingAs;
        }
        
        next();
    });

    bot.command('pose', (bot, message) => {
        if (!message.sender.isAdmin) {
            bot.error('You don\'t have permission to pose.');
            return;
        }
        if (message.text.length == 0) {
            bot.error('Please specify the channel id to pose.');
            return;
        }
        let chatId = message.chat.realId || message.chat.id;
        db.update({ chatId }, { chatId, posingAs: message.text }, { upsert: true }, function () {
            bot.respond(`This chat is now posing as another chat.`);
        });
    });

    bot.command('unpose', async (bot, message) => {
        if (!message.sender.isAdmin) {
            bot.error('You don\'t have permission to pose.');
            return;
        }
        let chatId = message.chat.realId || message.chat.id;
        db.remove({ chatId }, { }, function (err, numRemoved) {
            if (numRemoved > 0) {
                bot.respond(`This chat is not posing anymore.`);
            }
            else {
                bot.error(`I was not able to stop this chat from posing.`);
            }
        });
    });
}
