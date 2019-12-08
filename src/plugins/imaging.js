const sharp = require('sharp');
const { Image, createCanvas } = require('canvas')

async function getSupportedImageBuffer(image, mimetype) {
    if (mimetype === 'image/png') {
        return Buffer.from(image, 'base64');
    }
    return await sharp(Buffer.from(image, 'base64'))
        .ensureAlpha()
        .png()
        .toBuffer();
}

async function convertImageBufferBack(buffer, destMimetype) {
    if (destMimetype === 'image/png') {
        return buffer;
    }

    let sharpInstance = sharp(buffer);

    if (destMimetype === 'image/webp') {
        sharpInstance = sharpInstance.webp();
    }
    else if (destMimetype === 'image/jpeg') {
        sharpInstance = sharpInstance.jpeg();
    }

    return await sharpInstance.toBuffer();
}

async function getImageMetadata(buffer) {
    return await sharp(buffer).metadata();
}

async function addText(bot, message, position) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }
    if (!message.text || message.text.length === 0) {
        bot.error('No text provided.');
        return;
    }

    let dataSplit = message.attachment.data.split(',');
    let mimetype  = dataSplit[0].match(/:(.*?);/)[1];
    let data = dataSplit[1];

    let buffer = await getSupportedImageBuffer(data, mimetype);
    if (!buffer) {
        bot.error('Could not load specified image.');
        return;
    }
    let metadata = await getImageMetadata(buffer);
    if (!metadata) {
        bot.error('Could not read metadata from image.');
        return;
    }

    let isUpPosition = position !== "down";

    const canvas = createCanvas(metadata.width, metadata.height);
    const ctx = canvas.getContext('2d');
    const canvasImage = new Image();
    canvasImage.onload = async () =>
    {
        try {
            ctx.drawImage(canvasImage, 0, 0);

            let textHeight = Math.round(metadata.height * 0.15);
            let textX = metadata.width / 2;
            let textY = isUpPosition ? 0 : metadata.height;
            ctx.font = `${textHeight}px Impact`;
            ctx.textAlign = "center";
            ctx.textBaseline = isUpPosition ? "top" : "bottom";
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 8;
            ctx.strokeText(message.text, textX, textY, metadata.width);
            ctx.fillStyle = "white";
            ctx.fillText(message.text, textX, textY, metadata.width);
            
            var imageData = await convertImageBufferBack(canvas.toBuffer(), mimetype);

            bot.respond({ attachment: {
                data: `data:${mimetype};base64,${imageData.toString('base64')}`,
                mimetype: mimetype,
                type: message.attachment.type
            }});
        }
        catch (err) {
            console.log(err);
            bot.error('Something wrong happened when drawing the text.');
        }
    };
    canvasImage.onerror = err => {
        bot.error('Could not load image into canvas.');
    };
    canvasImage.src = buffer;
}

export default function(bot) {
    bot.command('addtext', async (bot, message) => addText(bot, message, "up"));
    bot.command('addtextdown', async (bot, message) => addText(bot, message, "down"));
}
