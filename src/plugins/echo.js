export default function(bot) {
    bot.command('echo', (bot, message) => {
        bot.respond({ text : message.text, attachment : message.attachment });
    });
}
