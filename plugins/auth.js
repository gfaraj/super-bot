var Datastore = require('nedb')
  , adminsDb = new Datastore({ filename: './data/admins.db', autoload: true });

adminsDb.ensureIndex({ fieldName: 'senderId' }, function (err) {
});

export function isAdmin(senderId) {
    return new Promise((resolve, reject) => {
        adminsDb.findOne({ senderId: senderId }, function (err, doc) {
            resolve(!!doc);
        });
    });
}

export function isOwner(senderId) {
    return new Promise((resolve, reject) => {
        adminsDb.findOne({ senderId: senderId, isOwner: true }, function (err, doc) {
            resolve(!!doc);
        });
    });
}

export default function(bot) {
    bot.use(async (bot, message, next) => {
        if (message.sender.isMe || await isAdmin(message.sender.id)) {
            message.sender.isAdmin = true;
        }
        
        next();
    });

    bot.command('auth', (bot, message) => {
        if (message.text.length == 0) {
            bot.error('Please specify the admin secret.');
            return;
        }
        let isAdmin = message.text.trim() === process.env.SUPERBOT_ADMIN_SECRET;
        let isOwner = message.text.trim() === process.env.SUPERBOT_OWNER_SECRET;        
        
        if (isAdmin || isOwner) {
            adminsDb.update({ senderId: message.sender.id }, { senderId: message.sender.id, isOwner }, { upsert: true }, function () {
                bot.respond(`You have been successfully authenticated as ${isOwner ? 'owner' : 'admin'}.`);
            });
        }
        else {
            bot.error('Incorrect admin secret specified.');
        }
    });

    bot.command('dethrone', async (bot, message) => {
        if (!await isOwner(message.sender.id)) {
            bot.error('You don\'t have permission to de-throne.');
            return;
        }
        if (message.text.length == 0) {
            bot.error('Please specify the user id to de-throne.');
            return;
        }

        adminsDb.remove({ senderId: message.text }, { }, function (err, numRemoved) {
            if (numRemoved > 0) {
                bot.respond(`I've de-throned ${message.text}.`);
            }
            else {
                bot.error(`I was not able to de-throne this user, perhaps he's not an admin.`);
            }
        });
    });
}
