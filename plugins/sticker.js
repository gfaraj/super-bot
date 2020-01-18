const sharp = require('sharp');

async function stickerize(bot, message, removeBg, trim) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }

    let processed = message;

    if (removeBg) {
        processed = await bot.receive(bot.copy(message).text('rembg'));
        if (!processed || !processed.attachment || !processed.attachment.data) {
            processed = message;
        }
    }

    let fit = message.text === "fill" ? sharp.fit.fill : sharp.fit.cover;
    let position = fit === sharp.fit.cover ? sharp.gravity.north : sharp.gravity.center;

    let data = processed.attachment.data.split(',')[1];
    let sharpInstance = sharp(Buffer.from(data, 'base64')).ensureAlpha();

    if (trim) {
        sharpInstance = sharpInstance.trim(5);
    }

    let stickerData = await sharpInstance
        .resize(512, 512, {
            fit,
            position,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .webp()
        .toBuffer();

    bot.respond({ attachment: {
        data: `data:image/webp;base64,${stickerData.toString('base64')}`,
        mimetype: 'image/webp',
        type: 'sticker'
    }});
}

export default function(bot) {
    bot.command('stickerize', async (bot, message) => {
        await stickerize(bot, message, true, true)
    });
    bot.command('faststicker', async (bot, message) => {
        await stickerize(bot, message, false, true)
    });
    bot.command('baresticker', async (bot, message) => {
        await stickerize(bot, message, false, false)
    });
}
