import express from 'express'
import { SuperBot } from './super-bot'

function main() {
    console.log('Starting SuperBot...');

    const config = require('config');
    const bot = new SuperBot(config.get("SuperBot"));
    
    const app = express();
    app.use(express.json());

    app.post('/message', function (req, res) {
        console.log(`Received: ${require('util').inspect(req.body, {depth:null})}`);
        bot.receive(req.body, (message) => {
            console.log(`Sending: ${require('util').inspect(message, {depth:null})}`);
            res.send(message);
        });
    });

    const port = config.get('app.port') || 3000;
    app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });
}

main();