import Message from './Message'
import MessageBuilder from './MessageBuilder'

export default class SuperBotProxy {

    constructor(bot, message, respondHandler) {
        this.bot = bot;
        this.message = message;
        this.respondHandler = respondHandler;
    }

    _sanitize(m) {
        if (typeof m === 'string') {
            m = this.new().text(m).build();
        }
        else if (m instanceof MessageBuilder) {
            m = m.build();
        }
        else if (!(m instanceof Message)) {
            m = this.new().raw(m).build();
        }
        return m;
    }

    new() {
        return new MessageBuilder(this.message);
    }

    respond(m) {
        if (this.respondHandler) {
            this.respondHandler(this._sanitize(m));
        }
    }

    async receive(m) {
        if (this.bot) {
            return await this.bot.receive(this._sanitize(m));
        }
    }
    async pass(m) {
        this.respond(await this.receive(m));
    }

    error(s) {
        this.respond(this.new().error(s).build());
    }

    copy(m) {
        return new MessageBuilder().raw(m);
    }
}