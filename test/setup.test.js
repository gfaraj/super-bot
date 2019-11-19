import { SuperBot } from "../src/super-bot";
import MessageBuilder from "../src/super-bot/MessageBuilder";

before(function() {
    this.timeout(6000);

    const config = require('config');
    this.bot = new SuperBot(config.get("SuperBot"));
    return this.bot.start();
});

beforeEach(function() {
    this.builder = new MessageBuilder();
    this.builder.raw({
        sender: { id: '123456', isMe: true }
    });
});