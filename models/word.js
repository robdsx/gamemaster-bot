const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    word: { type: String, required: true },
    suppressed: { type: Boolean, default: false }
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

wordSchema.static('addWords', async(words) => {
    await mongoose.model('Word').deleteMany({}).exec();
    const result = mongoose.model('Word').insertMany(words);
});

wordSchema.static('suppressWord', async(word) => {
    const updatedWord = await mongoose.model('Word').findOneAndUpdate({ word: word }, { suppressed: true });
    if(!updatedWord) return false;
    return word;
});

const Word = mongoose.model('Word', wordSchema);

module.exports = Word;