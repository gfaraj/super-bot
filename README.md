# super-bot
A simple but extensible bot written in Node.js. Currently there is only a Whatsapp interface, but any messaging platform can be supported by creating a client for it (e.g Slack, MS Teams, IRC).

## Starting the bot

The root of this repository contains the bot service. You can run it with the following command:

```
npm run start
```

The Whatsapp interface is located in ./clients/whatsapp and you can run that separately by setting that as the current directory and using the same run command.

## Configuration

The bot uses a JSON configuration file located in the ./config folder. See the [config](https://docs.npmjs.com/cli/config) package documentation for more information. The Whatsapp client is also configured this way.


## Supported commands

The bot is driven by plugins. Each plugin can define any number of commands that it supports (a command can only be supported by a single plugin). A plugin can also subscribe to be called whenever a message has not been handled by any command (for example, as a fallback). It's required that a plugin export a default function that will be called during initialization.

```
export default function(bot) {
    bot.command('record', handleRecord);
    bot.command('forget', handleForget);
    bot.command('recordings', handleRecordings);
    bot.raw(handleRaw);
}
```


