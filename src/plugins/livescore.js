const axios = require('axios');
const cheerio = require('cheerio');
const livescore_url = 'http://www.livescores.com/';

function extractLiveScoreFinal(body, searchTerm) {
    return new Promise(function (resolve, reject) {        
        const $ = cheerio.load(body);
        const searchTermLower = searchTerm.toLowerCase();

        $('.content > .row-gray').each(function(i, elem) {
            let text = $(this).text();
            if (text.toLowerCase().includes(searchTermLower)) {
                resolve(text.replace('\n', ' '));
                return false;
            }
        });    

        resolve(null);
    });
}

function extractLiveScoreAllFinal(body, searchTerm) {
    return new Promise(function (resolve, reject) {        
        const $ = cheerio.load(body);
        const searchTermLower = searchTerm.toLowerCase();

        $('.content > .row-tall').each(function(i, elem) {
            let text = $(this).text();
            if (text.toLowerCase().includes(searchTermLower)) {
                let results = [];
                $(this).nextUntil('.row-tall', '.row-gray').each(function (i, elem) {
                    results.push($(this).text().replace('\n', ' ').trim());
                });
                resolve(text + '\n' + results.join('\n'));
                return false;
            }
        });    

        resolve(null);
    });
}

function handleLiveScore(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a team name!');
        return;
    }
    axios.get(livescore_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36' } 
    })
    .then(async response => {
        let result = await extractLiveScoreFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    })
    .catch(error => {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    });
}

function handleLiveScoreAll(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a category name!');
        return;
    }
    axios.get(livescore_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36' } 
    })
    .then(async response => {
        let result = await extractLiveScoreAllFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    })
    .catch(error => {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    });
}

export default function(bot) {
    bot.command('livescore', handleLiveScore);
    bot.command('liveall', handleLiveScoreAll);
}
