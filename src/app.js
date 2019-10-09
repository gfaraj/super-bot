import express from 'express'
import { SuperBot } from './super-bot'

async function main() {
    console.log('Starting SuperBot...');

    const config = require('config');
    const bot = new SuperBot(config.get("SuperBot"));

    await bot.start();
    
    const app = express();
    app.use(express.json({ limit: '20mb' }));

    app.post('/message', async (req, res) => {
        try {
            console.log(`Received: ${require('util').inspect(req.body, {depth:null})}`);
            let message = await bot.receive(req.body);
            console.log(`Sending: ${require('util').inspect(message, {depth:null})}`);
            res.send(message);
        }
        catch (error) {
            console.log(error);
        }
    });

    const port = config.get('app.port') || 3000;
    app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });
}

main();