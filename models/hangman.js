const mongoose = require('mongoose');

const hangmanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    memberId: { type: String, required: true },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    longestWordFound: { type: String },
    score: { type: Number, default: 0 }
});

const Hangman = mongoose.model('Hangman', hangmanSchema);

module.exports = Hangman;