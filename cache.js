const Guild = require('./models/guild');
const Word = require('./models/word');

class Cache {

    async populate() {
        let guilds = await Guild.find({}).lean().exec();
        let wordList = await Word.find({ suppressed: false }).lean().exec();
        console.log(wordList.length);
        this.guilds = {};
        this.words = {
            lowest: 1000,
            highest: 0,
            list: {}
        };
        this.throttling = {};
        guilds.forEach(guild => {
            this.guilds[guild.guildID] = guild;
            this.guilds[guild.guildID].lastErrors = [];
        });
        wordList.forEach(wordEntry => {
            if(!this.words.list.hasOwnProperty(wordEntry.word.length)) {
                this.words.list[wordEntry.word.length] = [];
            }
            if(wordEntry.word.length < this.words.lowest) {
                this.words.lowest = wordEntry.word.length;
            }
            if(wordEntry.word.length > this.words.highest) {
                this.words.highest = wordEntry.word.length;
            }
            this.words.list[wordEntry.word.length].push(wordEntry.word);
        });
    }

    get(cache) {
        if(this[cache]) return this[cache];
        return false;
    }

    constructor() {
        if(!Cache.instance) {
            this.guilds = {};
            this.words = new Map();
            Cache.instance = this;
        }
        return Cache.instance;
    }
}

const instance = new Cache();

module.exports = instance;