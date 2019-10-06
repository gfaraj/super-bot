# super-bot
A simple but extensible bot written in Node.js. Currently there is a Whatsapp and a Slack interface, but any messaging platform can be supported by creating a client for it (e.g FB Messenger, MS Teams, IRC).

## Starting the bot

The root of this repository contains the bot service. You can run it with the following command:

```
npm run start
```

The bot service starts a web server on port 3000 (which is configurable) and accepts POST requests on "http://localhost:3000/message" with the body being JSON data representing a message object. The bot then will run that message through any commands that are supported and sends back the response. This makes it really easy to have any number of interfaces tied to the same bot service. Currently there's no security to restrict access to this endpoint so be aware that anyone could post messages to the bot.

The Whatsapp interface is located in ./clients/whatsapp and you can run that separately by setting that as the current directory and using the same run command.

## Configuration

The bot uses a JSON configuration file located in the ./config folder. See the [config](https://docs.npmjs.com/cli/config) package documentation for more information. The Whatsapp client is also configured this way.


## Plugins

The bot is driven by plugins. Each plugin can define any number of commands that it supports (a command can only be supported by a single plugin). A plugin can also subscribe to be called whenever a message has not been handled by any command (for example, as a fallback). It's required that a plugin export a default function that will be called during initialization.

```
export default function(bot) {
    bot.command('record', handleRecord);
    bot.command('forget', handleForget);
    bot.command('recordings', handleRecordings);
    bot.raw(handleRaw);
}
```

### record

This plugin allows you (and your friends) to record key-value pairs with optional attachments (currently only images and Whatsapp stickers are supported). The recordings are scoped per chat. There is a plan to support global recordings in the future.

```
record <name> <value>
```

The value is optional if an attachment is provided.

The plugin also registers the "forget" command to remove a recording. Only you or the recording's author are allowed to do this. It also registers the "recordings" command which sends a list of all existing recordings that match a given string (or all if no string is provided).

Examples:
```
record hi Hello everyone!
```
After doing that, when the bot is given the command "hi" it will respond with "Hello everyone!".
```
(as a reply to an image message)
record kids
```
The Whatsapp client will append any replied message to the current command, so in the example above it will save a "kids" recording with the image attachment. Then when the bot is given the "kids" command, it will send that image.

```
record stocks !google stock msft
```
This is an unofficial way to write shortcuts to other commands. After the command above, if given the "stocks" command, the bot will respond with "!google stock msft" and it will then respond to that command. In the future, a proper command chaining feature based on piping is planned.

### translate

This plugin translates a given text into a target language like so:

```
translate es Hi, how are you doing?
```
It takes a two-letter locale as the first parameter and the text to translate after it.

This uses the Google Translate API to perform the translation. You need to [set up a Google Cloud project](https://cloud.google.com/translate/docs/quickstart-client-libraries#client-libraries-usage-nodejs) with Translate support to be able to use this plugin. There is a cost to this if the free quotas are exceeded, so be mindful of that.

### google

This plugin will perform a Google search and return the first 2 results. It's currently scraping the google search results (using puppeteer to process and render the initial web page, then using cheerio to grab the information). This is not permitted by Google so use at your own risk. 
```
google game of thrones
```
The response is something like:
```
1) https://www.hbo.com/game-of-thrones
2) https://en.wikipedia.org/wiki/Game_of_Thrones
```

This plugin also exposes a "gimg" command that performs a Google Image Search and sends back the first image result (sends the actual image, not just a link). Currently it's returning a low-res image but it's possible to adjust it to get the original image.

### evaluate

This plugin will evaluate an expression and respond with the result. It exposes two commands, eval and calc. The eval command accepts any type of (limited - it uses safe-eval) javascript expression, while the calc command will only work with numeric expressions.

```
eval 'Hello' + ' world!'
calc 10 + 20 / 2
calc 15 - sqrt(4)
```
Responds with:
```
Hello world!
20
13
```

## Whatsapp Client

The Whatsapp client works on top of the Whatsapp Web application. The API is not public, so any changes made by Whatsapp could disrupt it at any time. The client relays messages to the bot service and sends back the bot's replies. It picks up messages that start with the "!" character as commands for the bot. It also has a couple of client-specific commands like "!screenshot" which takes a screenshot of only the current chat and sends it there, and "!moment <name>" which takes the screenshot and also issues a "!record [name]" command to save the screenshot.

The client supports sending custom stickers by using a very unreliable hack, since Whatsapp Web does not support this at all. It seems to be working correctly, but please enter an issue if you find a bug.

## Slack Client

The Slack client is built using [Botkit](https://www.npmjs.com/package/botkit) version 0.7.0. It's not using the latest version of Botkit (v4 at the time of this writing) because it doesn't support the RTM API, and this is needed if you can't expose a public endpoint for Slack to push new messages. Currently, the Slack client only supports text messages. Support for images and other more advanced features is under construction.

# Disclaimer

This project was done for educational purposes. This code is in no way affiliated with, authorized, maintained, sponsored or endorsed by WhatsApp or any of its affiliates or subsidiaries. This is an independent and unofficial software. Use at your own risk.
