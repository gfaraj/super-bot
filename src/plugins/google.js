
function handleGoogle(bot, message) {
    bot.respond('test');
}

export default function(bot) {
    bot.command('google', handleGoogle);
}
