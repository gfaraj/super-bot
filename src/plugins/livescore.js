const axios = require('axios');
const cheerio = require('cheerio');
const livescore_url = 'http://www.livescores.com';

function httpGet(url) {
    return axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36' } 
    });
}

function httpGetLiveScore() {
    return httpGet(livescore_url);
}

function extractLiveScoreMatchFacts1($) {
    let results = '';
    let category = $('.content').children().first('.row-tall');
    if (!category) {
        return null;
    }
    results = category.next().text();

    //category.next('.row-tall').first().nextUntil('.row-tall').each(function(i, elem) {
    category.nextAll('.md').each(function(i, elem) {
        $(this).children().each(function (i, elem) {
            results += '\n' + $(this).text();
            if ($(this).find('.yellowcard').length > 0) {
                results += ' (yellow card)';
            }
            else if ($(this).find('.goal').length > 0) {
                results += ' (goal)';
            }
            else if ($(this).find('.redyellowcard').length > 0) {
                results += ' (yellow + red card)';
            }
            else if ($(this).find('.redcard').length > 0) {
                results += ' (red card)';
            }
        });
    });

    return results;
}

function extractLiveScoreMatchFacts2($) {
    let results = $('.row-tall').first().text();

    $('.row.bt').first().nextUntil('.row.bt', '.row-gray').each(function(i, elem) {
        $(this).children().each(function (i, elem) {
            results += '\n' + $(this).text().trim();
            if ($(this).find('.yellowcard').length > 0) {
                results += ' (yellow card)';
            }
            else if ($(this).find('.goal').length > 0) {
                results += ' (goal)';
            }
            else if ($(this).find('.redyellowcard').length > 0) {
                results += ' (yellow + red card)';
            }
            else if ($(this).find('.redcard').length > 0) {
                results += ' (red card)';
            }
        });
    });

    return results;
}

function extractLiveScoreMatchFacts(body) {
    const $ = cheerio.load(body);
    let results = extractLiveScoreMatchFacts1($);
    if (!results) {
        results = extractLiveScoreMatchFacts2($);
    }
    return results;
}

function extractLiveScoreMatchFinal(body, searchTerm) {
    return new Promise(async (resolve, reject) => {        
        const $ = cheerio.load(body);
        const searchTermLower = searchTerm.toLowerCase();
        let url = '';

        $('.content > .row-gray').each(function(i, elem) {
            let text = $(this).text();
            if (text.toLowerCase().includes(searchTermLower)) {
                let link = $(this).find('a');
                if (link) {
                    url = link.attr('href');
                }
                else {
                    resolve(text.replace('\n', ' '));
                }
                return false;
            }
        });
        
        if (url && url.length > 0) {
            let response = await httpGet(livescore_url + url);
            let matchFacts = extractLiveScoreMatchFacts(response.data);
            resolve(matchFacts);
        }
        else {
            resolve(null);
        }
    });
}

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

async function handleLiveScore(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a team name!');
        return;
    }
    try {
        let response = await httpGetLiveScore();
        let result = await extractLiveScoreFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    }
    catch(error) {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    }
}

async function handleLiveScoreMatch(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a team name!');
        return;
    }
    try {
        let response = await httpGetLiveScore();
        let result = await extractLiveScoreMatchFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    }
    catch(error) {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    }
}

async function handleLiveScoreAll(bot, message) {
    let searchTerm = message.text;
    if (searchTerm.length == 0) {
        bot.error('Please specify a category name!');
        return;
    }
    try {
        let response = await httpGetLiveScore();
        let result = await extractLiveScoreAllFinal(response.data, searchTerm);
        bot.respond(result || 'I didn\'t find anything');
    }
    catch(error) {
        bot.error(`Sorry, I\'m having trouble contacting LiveScore right now. ${error}`);
    }
}

export default function(bot) {
    bot.command('livescore', handleLiveScore);
    bot.command('liveall', handleLiveScoreAll);
    bot.command('livem', handleLiveScoreMatch);
}
