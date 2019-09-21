
const safeEval = require('safe-eval');

function evaluate(bot, message) {
    if (message.text == null || message.text.length == 0) {
        bot.error('Give me an expression to evaluate!');
        return;
    }
    try {
        bot.respond(`${safeEval(message.text)}`);
    }
    catch (err) {
        console.log(err);
        bot.error('Your expression could not be evaluated.');
    }
}

function calculate(bot, message) {
    if (message.text == null || message.text.length == 0) {
        bot.error('Give me an expression to calculate!');
        return;
    }
    try {
        bot.respond(`${safeEval('1 * (' + message.text + ')')}`);
    }
    catch (err) {
        console.log(err);
        bot.error('Please specify a valid mathematical expression.');
    }
}

export default function(bot) {
    bot.command('eval', evaluate);
    bot.command('calc', calculate);
}
