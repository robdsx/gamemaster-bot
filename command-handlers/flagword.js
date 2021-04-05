const Word = require('../models/word');
const cache = require('../cache');
const embed = require('../modules/embed');

async function execute(message, args) {
    if(!args || !args[0]) {
        const reply = embed.generate('incomplete', 'Missing word', "I need to know which word you want to flag for removal :thinking:");
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
                cache.words.list[word.length].splice(cache.words.list[word.length].indexOf(word), 1);
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
        reply = embed.generate('success', 'Word removed', `I've removed **${word}** from my database. You won't see it again!`);
    }
    if(result === 'VOTE_COUNTED') {
        reply = embed.generate('success', 'Word flagged', `I've flagged **${word}** for review. Thanks!`);
    }
    if(result === 'NO_SUCH_WORD') {
        reply = embed.generate('warning', 'Word not in database', `**${word}** isn't in my database, are you sure you spelled it correctly?`);
    }
    await message.channel.send(reply);
}

module.exports = {
	name: 'flagword',
	description: embed.generate('generic', `:information_source: flagword`, 'Flag a word from the hangman database as being too difficult, obscure or not really one word')
                    .addFields(
                        { name: 'Command', value: '.flagword' },
                        { name: 'Options', value: ':grey_question:**word** *The word to be flagged for removal*'},
                    ),
	execute: execute
};