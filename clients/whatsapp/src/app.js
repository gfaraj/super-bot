import WhatsappClient from './WhatsappClient';

async function main() {
    console.log('Starting SuperBot for Whatsapp...');

    const config = require('config');
    let client = new WhatsappClient(config.get('WhatsappClient'));
    await client.start();
}

main();