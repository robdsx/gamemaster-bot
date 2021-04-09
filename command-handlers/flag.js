const Word = require('../models/word');
const cache = require('../cache');
const messageBuilder = require('../helpers/message-builder');

async function execute(message, args) {
    if(!args || !args[0]) {
        const reply = messageBuilder.embed("I need to know which word you want to flag for removal :thinking:", {
            template: 'incomplete',
            title: 'Missing word'
        });
        await message.channel.send(reply);
        return;
    }
    let votesForRemoval;
    let suppressed = false;
    let result = '';
    const word = args[0];
    try {
        const existingWordRecord = await Word.findOne({ word: word }).exec();
        if(existingWordRecord) {
            votesForRemoval = existingWordRecord.votesForRemoval + 1;
            if(existingWordRecord.votesForRemoval + 1 > 3 || message.member.hasPermission('ADMINISTRATOR')) {
                suppressed = true;
                const words = cache.get('words');
                cache.set('words', words[word.length].splice(words[word.length].indexOf(word), 1));
                result = 'WORD_REMOVED';
            } else {
                result = 'VOTE_COUNTED';
            }
            const wordRecord = await Word.findOneAndUpdate({ word: word }, {
                suppressed: suppressed,
                votesForRemoval: votesForRemoval
            }, { new: true, upsert: true });
        } else {
            result = 'NO_SUCH_WORD';
        }
    } catch(err) {
        console.error(err);
    }
    let reply;
    if(result === 'WORD_REMOVED') {
        reply = messageBuilder.embed(`I've removed **${word}** from my database. You won't see it again!`, {
            template: 'success',
            title: 'Word removed',
        });
    }
    if(result === 'VOTE_COUNTED') {
        reply = messageBuilder.embed(`I've flagged **${word}** for review. Thanks!`, {
            template: 'success',
            title: 'Word flagged',
        });
    }
    if(result === 'NO_SUCH_WORD') {
        reply = messageBuilder.embed(`**${word}** isn't in my database, are you sure you typed it correctly?`, {
            template: 'warning',
            title: 'Can\'t find word',
        });
    }
    await message.channel.send(reply);
}

module.exports = {
	name: 'flag',
    description: 'Flags a hangman word or phrase for review, if it doesn\'t make sense or isn\'t a real word!',
    aliases: ['fw', 'flag'],
    usage: 'flag [word or phrase]',
	execute: execute
};