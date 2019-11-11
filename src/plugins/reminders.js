const axios = require('axios');
const moment = require('moment');
var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/reminder.db', autoload: true });

db.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
}

function parseWhen(when) {
    var now = new Date();
    var mom = moment().seconds(0);
    var matches = when.match(/\d+[y,m,w,d,h,m]/g);
    if (matches) {
        for (let m of matches) {
            let number = m.substr(0, m.length - 1);
            let unit = m.substr(m.length - 1, 1);
            mom.add(number, unit);
        }
        return mom.toDate();
    }
    return null;
}

export default function(bot) {
    bot.command('remindme', (bot, message) => {
        let parsedText = parse(message.text);
        let when = parsedText[0];
        if (when.length == 0) {
            bot.error('Usage: remindme <when> <what>');
            return;
        }
        let what = parsedText[1];
        if (what.length == 0 && !message.attachment) {
            bot.error('Usage: remindme <when> <what>');
            return;
        }
        if (!message.callbackUrl || message.callbackUrl.length == 0) {
            bot.error('Sorry, your bot client does not support this!');
            return;
        }

        let date = parseWhen(when);

        if (!date) {
            bot.error("You didn't specify a correct time for the reminder.");
            return;
        }
        
        db.insert({ 
            chatId: message.chat.id, 
            active: true, 
            reminderDate: date,
            description: what,
            author: message.sender.id, 
            text: message.text,
            attachment: message.attachment,
            callbackUrl: message.callbackUrl
        }, (err, doc) => {
            if (err) {
                bot.error("Could not create a new reminder!");
            }
            else {
                bot.respond(`Ok, I'll remind you.`);
            }
        });
    });
}

(function checkReminders() {
    var now = new Date();

    db.findOne({ reminderDate: { $lte: now }, active: true }, (err, doc) => {
        if (doc) {
            db.update({ _id: doc._id }, { active: false });

            let message = {
                chat: { id: doc.chatId },
                text: `Reminder: ${doc.description}`,
                attachment: doc.attachment
            }
            axios.post(doc.callbackUrl, message)
            .then(async response => {
                if (response.status == 200) {
                    console.log(`Received back: ${JSON.stringify(response.data)}`);
                }
            });
        }
        setTimeout(checkReminders, 60000);    
    });
    if (now.getDate() === 12 && now.getHours() === 12 && now.getMinutes() === 0) {
        cb();
    }
})();
