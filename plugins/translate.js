const {Translate} = require('@google-cloud/translate');

const translater = new Translate({projectId: process.env.GOOGLE_PROJECT_ID});

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

async function translate(bot, message) {
    let parsedText = parse(message.text);
    let target = parsedText[0].toLowerCase();
    if (target.length == 0) {
        bot.error('Usage: translate <target-language> <text>');
        return;
    }
    let rest = parsedText[1];
    if (rest.length == 0) {
        bot.error('Usage: translate <target-language> <text>');
        return;
    }

    try {
        const [translation] = await translater.translate(rest, target);
        bot.respond(`${translation}`);
    }
    catch (err) {
        console.log(err);
        bot.error('I couldn\'t translate that.');
    }
}

export default function(bot) {
    bot.command('translate', translate);
    bot.command('tran', translate);
}
