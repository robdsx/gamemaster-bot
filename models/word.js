const mongoose = require('mongoose');
const Discord = require('discord.js');

const wordSchema = new mongoose.Schema({
    word: { type: String, required: true },
    suppressed: { type: Boolean, default: false },
    votesForRemoval: { type: Number, default: 0 }
});

wordSchema.static('addWords', async(words) => {
    await mongoose.model('Word').deleteMany({}).exec();
    const result = mongoose.model('Word').insertMany(words);
});

wordSchema.static('cacheData', async function() {
    const wordCache = {};
    let shortestWordLength = Number.MAX_SAFE_INTEGER;
    let longestWordLength = 0;
    const words = await this.find({ suppressed: false }).lean().exec();
    words.forEach(word => {
        const length = word.word.length;
        if(length > longestWordLength) longestWordLength = length;
        if(length < shortestWordLength) shortestWordLength = length;
        if(!wordCache.hasOwnProperty(length)) {
            wordCache[length] = [];
        }
        wordCache[length].push(word.word);
    });
    wordCache.$shortest = shortestWordLength;
    wordCache.$longest = longestWordLength;
    return wordCache;
});

wordSchema.static('random', async (length = 0) => {
    const count = await mongoose.model('Word').estimatedDocumentCount();
    const query = { 
        suppressed: false,
        "$expr": {
            "$gte": [{ "$strLenCP": "$word" }, length]
        }  
    }
    let word = null;
    let attempts = 0;
    while(word == null && attempts < 5) {
        let random = Math.floor(Math.random() * count);
        word = await mongoose.model('Word').findOne(query, 'word').skip(random).lean().exec();
        attempts++;
    }
    if(word == null) {
        const words = await mongoose.model('Word').find(query, 'word').lean().exec();
        console.log(words);
        if(words) {
            let random = Math.floor(Math.random() * words.length);
            word = {
                word: words[random]
            };
        }
    }
    return word.word || false;
});

wordSchema.static('suppressWord', async(word) => {
    const updatedWord = await mongoose.model('Word').findOneAndUpdate({ word: word }, { suppressed: true });
    if(!updatedWord) return false;
    return word;
});

const Word = mongoose.model('Word', wordSchema);

module.exports = Word;