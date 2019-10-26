const dialogflow = require('dialogflow');

let sessionClient = null;

export default function(bot) {
    bot.command('natural', async (bot, message) => {
        if (!sessionClient) {
            sessionClient = new dialogflow.SessionsClient();
        }

        const sessionPath = sessionClient.sessionPath(process.env.GOOGLE_PROJECT_ID, message.chat.id);
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: message.text,
                    languageCode: 'en-US',
                },
            },
        };
        const responses = await sessionClient.detectIntent(request);
        if (responses.length > 0) {
            const result = responses[0].queryResult;        
            bot.respond(result.fulfillmentText);
        }
        else {
            bot.respond("I didn't quite get that. What do you mean?");
        }
    });
}
