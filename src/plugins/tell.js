function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

export default function(bot) {
    bot.command('tell', (bot, message) => {
        let parsedText = parse(message.text);
        bot.pass({ text: parsedText[1], attachment: message.attachment, addressee: parsedText[0], sender: message.sender, chat: message.chat });
    });
}
