const mongoose = require('mongoose');

const hangmanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    memberId: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    scores: [Number],
    totalScore: { type: Number, default: 0 }
});

hangmanSchema.virtual('averageScore').get(function() {
    return Math.round(this.totalScore / this.gamesPlayed);
});

hangmanSchema.static('leaderboard', async function(guildID, limit = 10, start = 0){
    const docCount = await mongoose.model('Hangman').countDocuments();
    const results = await mongoose.model('Hangman').find({ guildId: guildID }).sort({ totalScore: 'desc' }).skip(start).limit(limit).exec();
    return { data: results, count: docCount };
});

const Hangman = mongoose.model('Hangman', hangmanSchema);

module.exports = Hangman;