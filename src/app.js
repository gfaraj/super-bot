import express from 'express'
import { SuperBot } from './super-bot'
import MessageBuilder from './super-bot/MessageBuilder';

function inspectMessage(msg) {
    return JSON.stringify(msg, function (key, value) {
        if (key === 'data' && typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '[...]';
        }
        return value;
    });
}

async function main() {
    console.log('Starting SuperBot...');

    const config = require('config');
    const bot = new SuperBot(config.get("SuperBot"));

    await bot.start();
    
    const app = express();
    app.use(express.json({ limit: '20mb' }));

    app.post('/message', async (req, res) => {
        console.log(`Received: ${inspectMessage(req.body)}`);

        try {
            const message = await bot.receive(req.body);

            console.log(`Sending: ${inspectMessage(message)}`);

            res.send(message);
        }
        catch (error) {
            console.log(error);

            const message = new MessageBuilder().error(error).build();
            console.log(`Sending error: ${inspectMessage(message)}`);
            res.send(message);
        }
    });

    const port = config.get('app.port') || 3000;
    app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });
}

main();