function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

export default function(bot) {
    bot.command('tell', async (bot, message) => {
        let parsedText = parse(message.text);
        bot.pass(bot.copy(message)
            .text(parsedText[1])
            .addressee(parsedText[0]));
    });
}
