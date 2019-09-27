export default function(bot) {
    bot.command('bot', (bot, message) => {
        bot.respond({ text : require('config').get('greeting') || 'Hello there human!' });
    });
}
