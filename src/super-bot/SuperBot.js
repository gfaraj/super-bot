var events = require('events');

const reservedCommands = new Set(['help', 'list']);

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
            console.log('Initializing plugin...');
            t.default(bot);
        })
        .catch(err => {
            console.error(err);
        });
    });
}

export default class SuperBot {
    commandEmitter = new events.EventEmitter();

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

    receive(message, handler) {
        if (handler == null) {            
            return;
        }

        this.responseHandler = handler;
        
        let parsedText = parse(message.text);
        
        let first = parsedText[0].toLowerCase();
        if (first.length === 0) {
            this.error('I don\'t understand that.');
            return;
        }

        if (this.commandEmitter.listenerCount(first) == 0) {
            this.error('I don\'t recognize that command.');
            return;
        }

        let command = first;
        message.text = parsedText[1];

        if (!this.commandEmitter.emit(command, this, message) || this.responseHandler != null) {
            this.error('Something went wrong.');
        }
    }

    error(error) {
        if (this.responseHandler != null) {
            this.responseHandler({ message: error, error: true });
            this.responseHandler = null;
        }
    }

    respond(message) {
        if (typeof message == 'string') {
            message = { text: message };
        }
        if (this.responseHandler != null) {
            this.responseHandler(message);
            this.responseHandler = null;
        }
    }
}