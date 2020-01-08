const _ = require('lodash');
const axios = require('axios');
const Datastore = require('nedb')
  , questions = new Datastore({ filename: './data/trivia_questions.db', autoload: true })
  , sessions = new Datastore({ filename: './data/trivia_sessions.db', autoload: true });

questions.ensureIndex({ fieldName: 'category' }, function (err) {
});

sessions.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

function sendCallbackMessage(doc, text) {
    let message = {
        chat: { id: doc.chatId },
        text
    };
    axios.post(doc.callbackUrl, message)
    .then(async response => {
        if (response.status == 200) {
            console.log(`Received back: ${JSON.stringify(response.data)}`);
        }
    })
    .catch(err => {
        console.log(err);
    });
}

function getTriviaResults(doc) {
    if (!doc.participants || doc.participants.length === 0) {
        return 'Nobody participated in this game.';
    }

    let results = [];
    for (let participant of doc.participants) {
        results.push({
            participant,
            score: doc.questions.reduce((prev, curr) => 
                prev + (curr.answeredBy && curr.answeredBy.id == participant.id ? 1 : 0), 0)
        });
    }
    results.sort((a, b) => b.score - a.score);

    let text = '';
    let index = 1;
    for (let result of results) {
        text += `${index}. ${result.participant.name || result.participant.id} => ${result.score}\n`;
        index++;
    }

    if (results.length === 1 || results[0].score !== results[1].score) {
        text += `${results[0].participant.name || results[0].participant.id} ${doc.active ? 'is winning' : 'won'}!`;
    }
    else {
        text += `It's ${doc.active ? 'currently ' : ''}a tie!`;
    }

    return text;
}

function addParticipant(doc, sender) {
    doc.participants = doc.participants || [];
    if (doc.participants.findIndex(p => p.id == sender.id) < 0) {
        doc.participants.push({
            id: sender.id,
            name: sender.name
        });
    }
}

function checkAnswer(bot, doc, message) {
    addParticipant(doc, message.sender);

    let answer = message.text.trim().toLowerCase();
    let question = doc.questions[doc.questions.length - 1];
    if (question.answers.findIndex(a => a.trim().toLowerCase() == answer) > -1) {
        question.isDone = true;
        question.answeredBy = {
            id: message.sender.id,
            name: message.sender.name,
            answer: message.text
        };
        doc.nextStateDate = new Date(new Date().getTime() + 2000);
        saveSession(doc);

        const greeting = _.sample(['Good', 'Great', 'Awesome', 'Nice', 'Excellent']);
        bot.respond(`${greeting}! The correct answer "${message.text}" was given by ${message.sender.name || message.sender.id}.`);
    }
    else {
        saveSession(doc);
    }
}

function saveSession(doc) {
    sessions.update({ _id: doc._id }, doc);
}

function inactivateSession(doc) {
    doc.active = false;
    saveSession(doc);
}

function hasActiveQuestion(doc) {
    return doc.questions.length > 0 && !doc.questions[doc.questions.length - 1].isDone;
}

function handleTimeout(doc) {
    let question = doc.questions[doc.questions.length - 1];
    doc.nextStateDate = new Date(new Date().getTime() + 3000);
    question.isDone = true;
    saveSession(doc);

    sendCallbackMessage(doc, `Time's out! Nobody gets points for this question.`);
}

function handleGameComplete(doc) {
    inactivateSession(doc);
    sendCallbackMessage(doc, `The game has ended after ${doc.questions.length} questions!\n\n${getTriviaResults(doc)}`);
}

function startNextQuestion(doc) {
    let query = {};
    if (doc.questions.length > 0) {
        query._id = { $nin: doc.questions.map(q => q.questionId) };
    }
    if (doc.category) {
        query.category = doc.category;
    }
    questions.count(query, function (err, count) {
        if (count === 0) {
            inactivateSession(doc);
            sendCallbackMessage(doc, `Could not retrieve a question for this trivia. Game over.\n\n${getTriviaResults(doc)}`);
            return;
        }

        let index = Math.floor(Math.random() * Math.floor(count));
        
        questions.find(query)
            .skip(index)
            .limit(1)
            .exec(function (err, docs) {
                if (err || docs.length === 0) {
                    inactivateSession(doc);
                    sendCallbackMessage(doc, `Could not retrieve a question for this trivia. Game over.\n\n${getTriviaResults(doc)}`);
                    return;
                }
                let question = docs[0];
                doc.questions.push({
                    questionId: question._id,
                    text: question.text,
                    answers: question.answers,
                    isDone: false
                });
                doc.nextStateDate = new Date(new Date().getTime() + 30000);
                saveSession(doc);
                
                sendCallbackMessage(doc, `Question #${doc.questions.length}: [${question.category}] ${question.text}`);
            });
    });
}

export default function(bot) {
    bot.use((bot, message, next) => {
        if (message.text && (message.text.toLowerCase() === "triviastop" || message.text.toLowerCase() === "trivia")) {
            next();
            return;
        }

        sessions.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
            if (!doc) {
                next();
            }
            else if (hasActiveQuestion(doc)) {
                checkAnswer(bot, doc, message);
            }
            else {
                bot.error("I haven't asked anything yet, take it easy!");
            }
        });
    });

    bot.command('trivia', (bot, message) => {
        sessions.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
            if (doc) {
                bot.respond(`Current Trivia:\n\n${getTriviaResults(doc)}`);
            }
            else {
                bot.respond("There is no active trivia at this moment.");
            }
        });
    });

    bot.command('triviastart', (bot, message) => {
        if (!message.callbackUrl || message.callbackUrl.length == 0) {
            bot.error('Sorry, your bot client does not support this!');
        }
        else {
            sessions.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
                if (doc) {
                    bot.respond("There's an active trivia, stop that first before starting a new one.");
                }
                else {                    
                    sessions.insert({
                        chatId: message.chat.id, 
                        active: true, 
                        author: message.sender.id, 
                        nextStateDate: new Date(new Date().getTime() + 5000),
                        category: message.text.toLowerCase(),
                        callbackUrl: message.callbackUrl,
                        questions: [],
                        participants: []
                    }, (err, doc) => {
                        if (err) {
                            bot.error("Could not start a new trivia game!");
                        }
                        else if (doc.category) {
                            bot.respond(`Trivia started for category "${message.text}" - Get ready!`);
                        }
                        else {
                            bot.respond(`Trivia started for all categories - Get ready!`);
                        }
                    });
                }
            });
        }
    });

    bot.command('triviastop', (bot, message) => {
        sessions.update({ chatId : message.chat.id, active: true }, {$set: {active: false}}, {returnUpdatedDocs:true}, function (err, numReplaced, doc) {
            if (numReplaced === 1) {                
                bot.respond(`Trivia Results:\n\n${getTriviaResults(doc)}\n\nThe game is over!`);
            }
            else {
                bot.respond("There are no active trivias at this moment.");
            }
        });
    });

    bot.command('triviaq', (bot, message) => {
        if (!message.text || message.text.length === 0) {
            bot.error('Please specify a question in this format: <category>`<question>`<answer>');
            return;
        }
        let tokens = message.text.split("`", 3);
        if (tokens.length !== 3) {
            bot.error('Please specify a question in this format: <category>`<question>`<answer>');
            return;
        }

        let category = tokens[0].trim();
        let text = tokens[1].trim();
        let answer = tokens[2].trim();

        if (category.length === 0 || text.length === 0) {
            bot.error('Please specify a category and the question text.');
            return;
        }

        let query = {
            category: { $regex: new RegExp(category.split(' ').join('|'), 'i') },
            text: { $regex: new RegExp(text.split(' ').join('|'), 'i') },
            answer: { $regex: new RegExp(answer.split(' ').join('|'), 'i') }
        };

        let doc = {
            author: message.sender.id,
            authorName: message.sender.name, 
            category,
            text,
            answers: [answer]
        };

        questions.update(query, doc, { upsert: true }, (err, doc) => {
            if (err) {
                bot.error("Could not create a new question!");
            }
            else {
                bot.respond(`Saved your question successfully.`);
            }
        });
    });
}

(function checkSessions() {
    var now = new Date();

    sessions.findOne({ nextStateDate: { $lte: now }, active: true }, (err, doc) => {
        try {
            if (doc) {
                if (hasActiveQuestion(doc)) {
                    handleTimeout(doc);
                }
                else if (doc.questions.length === 10) {
                    handleGameComplete(doc);
                }
                else {
                    startNextQuestion(doc);
                }
            }
        }
        catch (err) {
            console.log("Error while handling next state for trivia.");
            console.log(err);
        }
        setTimeout(checkSessions, 1000);    
    });
})();
