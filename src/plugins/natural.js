
function natural(bot, message) {
    if (message.text == null) {
        bot.error('Expected a text message.');
        return;
    }
    if (message.text.includes('?')) {
        bot.respond('Yes!');
    }
    else {
        bot.respond('Oh, tell me more.');
    }
}

export default function(bot) {
    bot.command('natural', natural);
}
