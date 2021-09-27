var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/poll.db', autoload: true });

db.ensureIndex({ fieldName: 'chatId' }, function (err) {
});

function getPollResults(poll) {
    let result = '';
    let totalVotes = poll.votes.length;
    for (const [i, c] of poll.choices.entries()) {
        let choiceId = i + 1;
        let voteCount = poll.votes.reduce((prev, curr) => prev + (curr.choiceId == choiceId ? 1 : 0), 0);
        let percent = totalVotes > 0 ? parseInt(voteCount / totalVotes * 100) : 0;
        result += `#${choiceId} ${c} -- ${percent}% (${voteCount} votes)\n`;
    }
    result += `Total votes: ${totalVotes}`;
    return result;
}

export default function(bot) {
    bot.command('poll', (bot, message) => {        
        if (message.text.length === 0) {
            db.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
                if (doc) {
                    bot.respond(`Current Poll: ${doc.text}\n\n${getPollResults(doc)}`);
                }
                else {
                    bot.respond("There are no active polls at this moment.");
                }
            });
        }
        else {
            let voteOnce = message.text.startsWith('-once');
            if (voteOnce) {
                message.text = message.text.substring(5).trim();
                if (message.text.length == 0) {
                    bot.respond("Please specify a poll question.");
                }
            }

            db.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
                if (doc) {
                    bot.respond("There's an active poll, close that first before starting a new one.");
                }
                else {
                    db.insert({ 
                        chatId: message.chat.id, 
                        active: true, 
                        voteOnce,
                        author: message.sender.id, 
                        text: message.text,
                        choices: [],
                        votes: [] 
                    }, (err, doc) => {
                        if (err) {
                            bot.error("Could not create new poll!");
                        }
                        else {
                            bot.respond(`Poll started: ${message.text}\n\nAdd choices using "choice" and vote using "vote". Close the poll using "pollclose".\n\nFor example: "choice Burgers" or "vote 2".`);
                        }
                    });
                }
            });
        }
    });

    bot.command('pollclose', (bot, message) => {
        db.update({ chatId : message.chat.id, active: true }, {$set: {active: false}}, {returnUpdatedDocs:true}, function (err, numReplaced, doc) {
            if (numReplaced === 1) {                
                bot.respond(`Poll: ${doc.text}\n\n${getPollResults(doc)}\n\nThis poll is closed!`);
            }
            else {
                bot.respond("There are no active polls at this moment.");
            }
        });
    });

    bot.command('choice', (bot, message) => {
        if (message.text.length === 0) {
            bot.error('Please specify the text for your choice.');
            return;
        }        
        db.update({ chatId : message.chat.id, active: true }, {$push: {choices: message.text}}, {returnUpdatedDocs:true}, function (err, numReplaced, doc) {
            if (numReplaced === 1) {
                bot.respond(`Added "${message.text}" as choice #${doc.choices.length}.`);
            }
            else {
                bot.respond("There are no active polls at this moment.");
            }
        });
    });

    bot.command('vote', (bot, message) => {
        let choiceId = parseInt(message.text);
        if (isNaN(choiceId)) {
            bot.error('Please specify the number of your choice.');
            return;
        }

        db.findOne({ chatId : message.chat.id, active: true }, function (err, doc) {
            if (doc) {
                if (choiceId < 1 || choiceId > doc.choices.length) {
                    bot.error('Please specify a valid choice number.');
                    return;
                }

                if (doc.votes.find(v => v.senderId === message.sender.id && v.choiceId === choiceId)) {
                    bot.error("You've already voted for this choice.");
                    return;
                }

                let notice = "Recorded your vote for";

                if (doc.voteOnce) {
                    let voteId = doc.votes.findIndex(v => v.senderId === message.sender.id);
                    if (voteId >= 0) {
                        notice = "Changed your vote to";
                        doc.votes.splice(voteId, 1);
                    }
                }

                let vote = {
                    senderId: message.sender.id,
                    choiceId
                };

                doc.votes.push(vote);

                db.update({ chatId : message.chat.id, active: true }, {$set: {votes: doc.votes}}, {}, function (err, numReplaced) {
                    if (numReplaced > 0) {
                        bot.respond(`${notice} "${doc.choices[choiceId - 1]}".`);
                    }
                    else {
                        bot.respond("There are no active polls at this moment.");
                    }
                });
            }
            else {
                bot.respond("There are no active polls at this moment.");
            }
        });
    });
}
