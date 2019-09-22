var events = require('events');

function parse(str) {
    let pos = str.indexOf(' ');
    return (pos === -1) ? [str, ''] : [str.substr(0, pos), str.substr(pos + 1)];
};

function loadPlugins(bot, path) {
    console.log(`Loading plugins from path: ${path}`);
    require('fs').readdirSync(path).forEach(function (file) {
        console.log(`Loading plugin: ${file}...`);

        import(require('path').join(path, file))
        .then(t => {
            console.log(`Initializing plugin: ${file}...`);
            t.default(bot);
            console.log(`Done plugin: ${file}...`);
        })
        .catch(err => {
            console.error(err);
        });
    });
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
    rawEmitter = new events.EventEmitter();

    constructor(options) {
        this.options = options;
        if (options.pluginsPath) {
            loadPlugins(this, require('path').join(__dirname, options.pluginsPath));
        }
    }

    command(command, handler) {
        command = command.toLowerCase();
        if (this.commandEmitter.listenerCount(command) > 0) {
            throw new Error(`Command already registered: ${command}`);
        }
        this.commandEmitter.on(command, handler);
    }

    raw(handler) {
        this.rawEmitter.on('message', handler);
    }

    receive(message, handler) {
        if (handler == null) {            
            return;
        }

        let callback = {
            error : function(error) {
                if (handler != null) {
                    handler({ message: error, error: true });
                    handler = null;
                }
            },        
            respond : function (message) {
                if (typeof message == 'string') {
                    message = { text: message };
                }
                if (handler != null) {
                    handler(message);
                    handler = null;
                }
            }
        }

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
            else if (this.rawEmitter.listenerCount('message') > 0) {            
                this.rawEmitter.emit('message', callback, message);

                setTimeout(() => {
                    if (handler != null) {
                        callback.error(`I don't recognize "${message.text}".`);
                    }
                }, 5000);
            }
            else {
                callback.error(`I don't recognize "${first}".`);
            }
        }
        catch (err) {
            console.log(err);
            callback.error('Something went wrong.');
        }
    }
}