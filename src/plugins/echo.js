export default function(bot) {
    bot.command('echo', (bot, message) => {
        bot.respond(bot.new().text(message.text).attachment(message.attachment));
    });
}
