const Guild = require('./models/guild');

class Cache {

    async populate() {
        let guilds = await Guild.find({}).lean().exec();
        this.guilds = {};
        guilds.forEach(guild => {
            this.guilds[guild.guildID] = guild;
            this.guilds[guild.guildID].lastErrors = [];
        });
    }

    constructor() {
        if(!Cache.instance) {
            this.guilds = '';
            Cache.instance = this;
        }
        return Cache.instance;
    }
}

const instance = new Cache();

module.exports = instance;