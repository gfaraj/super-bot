export default function(bot) {
    bot.command('bot', (bot, message) => {
        bot.respond({ text : require('config').get('greeting') || 'Hello there human!' });
    });
    bot.command('cleartext', async (bot, message) => {
        bot.respond(bot.copy(message)
            .text(''));
    });
    bot.command('clearattach', async (bot, message) => {
        bot.respond(bot.copy(message)
            .attachment({}));
    });
    bot.command('clear', async (bot, message) => {
        bot.pass(bot.copy(message)
            .text('cleartext')
            .pipe('clearattach'));
    });
}
