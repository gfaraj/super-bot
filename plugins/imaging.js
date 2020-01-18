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

async function getAttachmentData(bot, attachment) {
    let dataSplit = attachment.data.split(',');
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

    return {
        buffer,
        metadata,
        mimetype
    };
}

function loadCanvasImage(buffer) {
    return new Promise((resolve, reject) => {
        let canvasImage = new Image();
        canvasImage.onload = () =>
        {
            resolve(canvasImage);
        };
        canvasImage.onerror = err => {
            reject('Could not load image into canvas.');
        };
        canvasImage.src = buffer; 
    });
}

let subjectImage = {};

async function setSubject(bot, message) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }

    subjectImage[message.chat.id] = message.attachment;

    bot.respond("I've stored the subject image.");
}

async function combine(bot, message, position) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }
    if (!subjectImage[message.chat.id]) {
        bot.error('No subject image set - use "subject" command first.');
        return;
    }

    let data = await getAttachmentData(bot, message.attachment);
    if (!data) {
        return;
    }

    let subjectData = await getAttachmentData(bot, subjectImage[message.chat.id]);
    if (!subjectData) {
        return;
    }
    
    const canvas = createCanvas(data.metadata.width + subjectData.metadata.width, 
        Math.max(data.metadata.height, subjectData.metadata.height));
    const ctx = canvas.getContext('2d');
    const image = await loadCanvasImage(data.buffer);
    const subject = await loadCanvasImage(subjectData.buffer);
    
    ctx.drawImage(subject, 
        0, canvas.height / 2 - subject.height / 2);

    ctx.drawImage(image,  
        canvas.width - image.width, 
        canvas.height / 2 - image.height / 2);

    let mimetype = "image/png";
    var imageData = await convertImageBufferBack(canvas.toBuffer(), mimetype);

    bot.respond({ attachment: {
        data: `data:${mimetype};base64,${imageData.toString('base64')}`,
        mimetype: mimetype,
        type: "image"
    }});        
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

    let data = await getAttachmentData(bot, message.attachment);
    if (!data) {
        return;
    }

    let isUpPosition = position !== "d";

    const canvas = createCanvas(data.metadata.width, data.metadata.height);
    const ctx = canvas.getContext('2d');
    const canvasImage = new Image();
    canvasImage.onload = async () =>
    {
        try {
            ctx.drawImage(canvasImage, 0, 0);

            let textHeight = Math.round(data.metadata.height * 0.15);
            let textX = data.metadata.width / 2;
            let textY = isUpPosition ? 0 : data.metadata.height;
            ctx.font = `${textHeight}px Impact`;
            ctx.textAlign = "center";
            ctx.textBaseline = isUpPosition ? "top" : "bottom";
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 8;
            ctx.strokeText(message.text, textX, textY, data.metadata.width);
            ctx.fillStyle = "white";
            ctx.fillText(message.text, textX, textY, data.metadata.width);
            
            var imageData = await convertImageBufferBack(canvas.toBuffer(), data.mimetype);

            bot.respond({ attachment: {
                data: `data:${data.mimetype};base64,${imageData.toString('base64')}`,
                mimetype: data.mimetype,
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
    canvasImage.src = data.buffer;
}

async function crop(bot, message, direction) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }

    let percent = !message.text || message.text.length === 0 ? 10 : Number.parseInt(message.text);
    percent /= 100;

    let data = await getAttachmentData(bot, message.attachment);
    if (!data) {
        return;
    }

    let offsetY = data.metadata.height * percent;
    let offsetX = data.metadata.width * percent;
    
    const canvas = createCanvas(data.metadata.width, data.metadata.height);
    const ctx = canvas.getContext('2d');
    const canvasImage = new Image();
    canvasImage.onload = async () =>
    {
        try {
            let sx = 0;
            let sy = (direction === "v" || direction == "d") ? offsetY : 0;
            let sw = canvasImage.width - ((direction === "l" || direction === "r") ? offsetX : direction === "h" ? offsetX * 2 : 0);
            let sh = canvasImage.height - ((direction === "u" || direction === "d") ? offsetY : direction === "v" ? offsetY * 2 : 0);
            let x = (direction === "l" || direction == "h") ? offsetX : 0;
            let y = (direction === "u" || direction == "v") ? offsetY : 0;
            
            ctx.drawImage(canvasImage, sx, sy, sw, sh, x, y, sw, sh);

            var imageData = await convertImageBufferBack(canvas.toBuffer(), data.mimetype);

            bot.respond({ attachment: {
                data: `data:${data.mimetype};base64,${imageData.toString('base64')}`,
                mimetype: data.mimetype,
                type: message.attachment.type
            }});
        }
        catch (err) {
            console.log(err);
            bot.error('Something wrong happened when drawing the image.');
        }
    };
    canvasImage.onerror = err => {
        bot.error('Could not load image into canvas.');
    };
    canvasImage.src = data.buffer;
}

async function addPadding(bot, message, direction) {
    if (!message.attachment || !message.attachment.data) {
        bot.error('No image provided.');
        return;
    }

    let percent = !message.text || message.text.length === 0 ? 10 : Number.parseInt(message.text);
    percent /= 100;

    let data = await getAttachmentData(bot, message.attachment);
    if (!data) {
        return;
    }

    let offsetY = data.metadata.height * percent;
    let offsetX = data.metadata.width * percent;
    
    const canvas = createCanvas(data.metadata.width, data.metadata.height);
    const ctx = canvas.getContext('2d');
    const canvasImage = new Image();
    canvasImage.onload = async () =>
    {
        try {
            let dw = canvasImage.width - (direction === "h" ? offsetX * 2 : 0);
            let dh = canvasImage.height - ((direction === "u" || direction === "d") ? offsetY : direction === "v" ? offsetY * 2 : 0);
            let x = direction === "h" ? offsetX : 0;
            let y = (direction === "u" || direction == "v") ? offsetY : 0;
            
            ctx.drawImage(canvasImage, 0, 0, canvasImage.width, canvasImage.height, x, y, dw, dh);

            var imageData = await convertImageBufferBack(canvas.toBuffer(), data.mimetype);

            bot.respond({ attachment: {
                data: `data:${data.mimetype};base64,${imageData.toString('base64')}`,
                mimetype: data.mimetype,
                type: message.attachment.type
            }});
        }
        catch (err) {
            console.log(err);
            bot.error('Something wrong happened when drawing the image.');
        }
    };
    canvasImage.onerror = err => {
        bot.error('Could not load image into canvas.');
    };
    canvasImage.src = data.buffer;
}

export default function(bot) {
    bot.command('meme', async (bot, message) => await addText(bot, message, "u"));
    bot.command('memeu', async (bot, message) => await addText(bot, message, "u"));
    bot.command('memed', async (bot, message) => await addText(bot, message, "d"));
    bot.command('pad', async (bot, message) => {
        let param = message.text || '';
        bot.pass(bot.copy(message).text(`padh ${param}`).pipe(`padv ${param}`));
    });
    bot.command('padu', async (bot, message) => await addPadding(bot, message, "u"));
    bot.command('padd', async (bot, message) => await addPadding(bot, message, "d"));
    bot.command('padv', async (bot, message) => await addPadding(bot, message, "v"));
    bot.command('padh', async (bot, message) => await addPadding(bot, message, "h"));
    bot.command('crop', async (bot, message) => {
        let param = message.text || '';
        bot.pass(bot.copy(message).text(`croph ${param}`).pipe(`cropv ${param}`));
    });
    bot.command('cropu', async (bot, message) => await crop(bot, message, "u"));
    bot.command('cropd', async (bot, message) => await crop(bot, message, "d"));
    bot.command('cropv', async (bot, message) => await crop(bot, message, "v"));
    bot.command('croph', async (bot, message) => await crop(bot, message, "h"));
    bot.command('subject', async (bot, message) => await setSubject(bot, message));
    bot.command('combine', async (bot, message) => await combine(bot, message, "r"));
}
