const mongoose = require('mongoose');

const fishSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    memberId: { type: String, required: true },
    fishCaught: { type: Number, default: 0 },
    fishGifted: { type: Number, default: 0 },
    catchHistory: [Number],
    giftHistory: [Number],
    lastFishTime: Date
});