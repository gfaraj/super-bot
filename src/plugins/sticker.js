const sharp = require('sharp');

export default function(bot) {
    bot.command('stickerize', async (bot, message) => {
        if (!message.attachment || !message.attachment.data) {
            bot.error('No image provided.');
            return;
        }

        let processed = await bot.receive(bot.copy(message).text('rembg'));
        if (!processed || !processed.attachment || !processed.attachment.data) {
            processed = message;
        }

        let data = processed.attachment.data.split(',')[1];
        let stickerData = await sharp(Buffer.from(data, 'base64'))
            .ensureAlpha()
            .trim(5)
            .resize(512, 512, {
                fit: sharp.fit.crop,
                position: sharp.gravity.north,
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
