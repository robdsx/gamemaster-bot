const mongoose = require('mongoose');
const Discord = require('discord.js');

const guildSchema = new mongoose.Schema({
    guildID: { type: String, required: true, index: { unique: true }},
    prefix: { type: String, required: true, default: '.' },
    botJoinedDate: { type: Date, default: Date.now() },
    botLeftDate: { type: Date },
    disabledCommands: [String]
});

guildSchema.static('exists', async function(guildId) {
    return await this.findOne({ guildID: guildId }).exec();
});

guildSchema.static('setPrefix', async function(guildId, prefix) {
    if(typeof prefix !== 'string' || prefix.length > 2) {
        return false;
    }
    const result = await this.findOneAndUpdate({ guildID: guildId }, { prefix: prefix }).exec();
    console.log(result);
    if(result) {
        return result.prefix;
    }
    return false;
});

guildSchema.static('cacheData', async function() {
    const guilds = await this.find({}).lean().exec();
    const guildCache = {};
    guilds.forEach(guild => {
        guildCache[guild.guildID] = guild;
    });
    return guildCache;
});

const Guild = mongoose.model('Guild', guildSchema);

module.exports = Guild;