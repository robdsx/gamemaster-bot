const mongoose = require('mongoose');
const cache = require('../cache');
const Guild = require('../models/guild');

async function setPrefix(guildID, prefix) {
    if(typeof prefix !== 'string' || prefix.length !== 1) {
        return false;
    }
    try {
        const result = await Guild.findOneAndUpdate({ guildID: guildID }, { prefix: prefix }).exec();
        cache.guilds[guildID].prefix = prefix;
        return true;
    } catch(err) {
        console.error(`[${guildID}] [guild.setPrefix]: ${err}`);
    }
}

async function exists(guildID) {
    const guild = await Guild.findOne({ guildID: guildID }).exec();
    if(!guild) return false;
    return true;
}

async function register(guildObject) {
    if(await exists(guildObject.id)) return;
    const guild = new Guild({ guildID: guildObject.id });
    await guild.save();
}

module.exports = {
    register: register,
    setPrefix: setPrefix
}