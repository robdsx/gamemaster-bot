const Discord = require('discord.js');
const Hangman = require('../models/hangman');
const embed = require('../modules/embed');

const supportedGames = {
    'hangman': Hangman.leaderboard
}

class Leaderboard {

    async updateLeaderboard(results) {
        const data = [];
        let reply = '';
        let list = '\n';
        const totalPages = Math.ceil(results.count / this.count);
        if(results.data.length < 1) {
            reply = "There's nobody on this leaderboard yet! You could be the first...";
        } else {
            for(let i = 0; i < results.data.length; i++) {
                const result = results.data[i];
                const position = (this.page === 1) ? i + 1 : (this.page * this.count) + i + 1;
                const memberName = await this.message.client.users.fetch(result.memberId);
                const score = result.totalScore;
                const avgScore = result.averageScore;
                const gamesPlayed = result.gamesPlayed;
                let prefix = '**#' + position + '**';
                if(position == '1') prefix = ':first_place:';
                if(position == '2') prefix = ':second_place:';
                if(position ==   '3') prefix = ':third_place:';
                list += `${prefix} **${memberName.username}#${memberName.discriminator}** - total **${score}**, average: ${avgScore}\n`;
            }
            reply = embed.generate('generic', ':scroll: Hangman leaderboard', list).setFooter(`Page ${this.page} of ${totalPages}`);
        }
        if(this.botMessage) {
            await this.botMessage.reactions.removeAll();
            this.reactionCollector.resetTimer({ time: 60000 });
            await this.botMessage.edit(reply);
            if(this.page > 1) {
                await this.botMessage.react('⬅️');
            }
            if(results.count > this.count * this.page) {
                await this.botMessage.react('➡️');
            }
            return;
        }
        const sentMessage = await this.message.channel.send(reply);
        this.botMessage = sentMessage;
        if(this.page > 1 || results.count > this.count * this.page) {
            if(this.page > 1) {
                await sentMessage.react('⬅️');
            }
            if(results.count > this.count * this.page) {
                await sentMessage.react('➡️');
            }
            const reactionFilter = (reaction, user) => {
                return !user.bot;
            };
            this.reactionCollector = sentMessage.createReactionCollector(reactionFilter, { time: 1200000 });
            this.reactionCollector.on('collect', async (reaction, user) => {
                if(reaction.emoji.name === '⬅️' && this.page > 1) {
                    this.getLeaderboard(this.page - 1);
                }
                if(reaction.emoji.name === '➡️' && results.count > this.count * this.page) {
                    this.getLeaderboard(this.page + 1);
                }
            });
            this.reactionCollector.on('end', async (collected) => {
                await this.botMessage.reactions.removeAll().catch((err) => { console.error(err); });
            });
        }
    }

    async getLeaderboard(page = 1) {
        //this.message.channel.startTyping();
        const start = (page === 1) ? 0 : this.count * (page - 1); 
        const results = await supportedGames[this.game].call(null, this.message.guild.id, this.count, start);
        this.page = page;
        await this.updateLeaderboard(results);
    }

    constructor(message, game) {
        this.game = game;
        this.message = message;
        this.botMessage = false;
        this.count = 10;
        this.page = 1;
    }
}

async function execute(message, args) {
    if(!args || !args[0]) {
        args = ['hangman'];
    }
    const leaderboard = new Leaderboard(message, args[0]);
    await leaderboard.getLeaderboard();
}

module.exports = {
	name: 'leaderboard',
	description: embed.generate('generic', `:information_source: leaderboard`, 'Show the leaderboard for a game')
                    .addFields(
                        { name: 'Command', value: '.leaderboard' },
                        { name: 'Options', value: '**[game]** *The name of the game (only hangman currently available)*' },
                    ),
	execute: execute
};