const mongoose = require('mongoose');

const hangmanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    memberId: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    games: [{
        won: { type: Boolean, default: false, required: true },
        score: { type: Number, default: 0, required: true },
        word: { type: String, required: true },
        date: { type: Date, default: Date.now() }
    }],
    totalScore: { type: Number, default: 0 }
});

hangmanSchema.virtual('averageScore').get(function() {
    return Math.round(this.totalScore / this.gamesPlayed);
});

hangmanSchema.virtual('recentGames').get(function() {
    const gamesCount = this.games.length;
    return this.games.slice(gamesCount - 5, gamesCount);
});

hangmanSchema.virtual('gamesWonLost').get(function() {
    let won = 0;
    this.games.forEach(game => {
        if(game.won) won++;
    });
    const lost = this.gamesPlayed - won;
    return {
        won: won,
        lost: lost
    }
});

hangmanSchema.static('leaderboard', async function(guildID, limit = 10, start = 0){
    const docCount = await mongoose.model('Hangman').countDocuments();
    const results = await mongoose.model('Hangman').find({ guildId: guildID }).sort({ totalScore: 'desc' }).skip(start).limit(limit).exec();
    return { data: results, count: docCount };
});

const Hangman = mongoose.model('Hangman', hangmanSchema);

module.exports = Hangman;