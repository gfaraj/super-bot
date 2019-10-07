const sharp = require('sharp');

export default function(bot) {
    bot.command('stickerize', async (bot, message) => {
        if (!message.attachment || !message.attachment.data) {
            bot.error('No image provided.');
            return;
        }

        let data = message.attachment.data.split(',')[1];
        let stickerData = await sharp(Buffer.from(data, 'base64'))
            .ensureAlpha()
            .resize(512, 512, {
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .webp()
            .toBuffer();

        bot.respond({ attachment: {
            data: `data:image/webp;base64,${stickerData.toString('base64')}`,
            mimetype: 'image/webp',
            type: 'sticker'
        }});
    });
}
