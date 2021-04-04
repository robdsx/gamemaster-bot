const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildID: { type: String, required: true, index: { unique: true }},
    prefix: { type: String, required: true, default: '.' },
    disabledCommands: [String]
});

const Guild = mongoose.model('Guild', guildSchema);

module.exports = Guild;