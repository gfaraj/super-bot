import Middleware from './Middleware'
var events = require('events');

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

async function loadPlugins(bot, path) {
    console.log(`Loading plugins from path: ${path}`);
    for (const file of require('fs').readdirSync(path)) {
        console.log(`Loading plugin: ${file}...`);
        try {
            var t = await import(require('path').join(path, file));
            
            console.log(`Initializing plugin: ${file}...`);
            t.default(bot);
            console.log(`Done plugin: ${file}...`);
        }
        catch(err) {
            console.error(err);
        }
    }
}

String.prototype.format = String.prototype.format ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

export default class SuperBot {
    commandEmitter = new events.EventEmitter();
    middleware = new Middleware();
    rawMiddleware = new Middleware();

    constructor(options) {
        this.options = options;        
    }

    async start() {
        if (this._started) return;
        this._started = true;

        this.command('all', (bot, message) => {
            bot.respond(this.commandEmitter.eventNames().join(', '));
        })

        if (this.options.pluginsPath) {
            await loadPlugins(this, require('path').join(__dirname, this.options.pluginsPath));
        }
    }

    use(fn) {
        this.middleware.use(fn);
        return this;
    }

    command(command, handler) {
        command = command.toLowerCase();
        if (this.commandEmitter.listenerCount(command) > 0) {
            throw new Error(`Command already registered: ${command}`);
        }
        this.commandEmitter.on(command, handler);
    }

    raw(handler) {
        this.rawMiddleware.use(handler);
    }

    receive(message, handler) {
        if (handler == null) {
            return;
        }

        let bot = this;

        let callback = {
            error: function(error) {
                if (handler != null) {
                    handler({ text: error, error: true });
                    handler = null;
                }
            },
            respond: function (m) {
                if (typeof m == 'string') {
                    m = { text: m };
                }
                m.addressee = message.addressee;
                if (handler != null) {
                    handler(m);
                    handler = null;
                }
            },
            pass: function (m) {
                bot.receive(m, handler);
                handler = null;
            }
        }

        this.middleware.go(callback, message, (b, message) => {
            let parsedText = parse(message.text);
        
            let first = parsedText[0].toLowerCase();
            if (first.length === 0) {
                callback.error('I don\'t understand that.');
                return;
            }

            try {
                if (this.commandEmitter.listenerCount(first) > 0) {
                    let command = first;
                    message.command = command;
                    message.fullText = message.text;
                    message.text = parsedText[1];
                
                    this.commandEmitter.emit(command, callback, message);

                    setTimeout(() => {
                        if (handler != null) {
                            callback.error('Something went wrong.');
                        }
                    }, 10000);
                }
                else {
                    this.rawMiddleware.go(callback, message, (b, message) => {
                        callback.error(`I don't recognize "${first}".`);
                    });
                }
            }
            catch (err) {
                console.log(err);
                callback.error('Something went wrong.');
            }
        });
    }
}