const Discord = require('discord.js');
const Hangman = require('../models/hangman');
const { update } = require('../models/word');
const Word = require('../models/word');
const cache = require('../cache');
const messageBuilder = require('../helpers/message-builder');
const Chance = require('chance');
const chance = new Chance();

const activeGames = new Map();
const sleepingGames = new Map();

class HangmanGame {
    constructor(message, word) {
        this.lastMessageID = false;
        this.message = message;
        this.guildID = message.guild.id;
        this.initiatingMemberID = message.author.id;
        this.avatarURL = message.author.avatarURL();
        this.word = word;
        this.guessedLetters = [];
        this.remainingLetters = word.split('');
        this.startingLives = 7;
        this.livesLeft = 7;
        this.usedHint = false;
        this.messageWaiting = false;
        this.placeholders = {
            unrevealedLetter: ':white_large_square:'
        }
    }

    async sendMessage(channel, msg) {
        return await channel.send(msg);
    }   

    async messageHandler(message) {
        this.collector.resetTimer({ time: 90000 });
        if(message.content.length === 1 && /^[a-zA-Z]/.test(message.content)) {
            let letter = message.content.toLowerCase();
            if(this.guessedLetters.indexOf(letter) > -1) {
                // Already guessed this letter
                await this.sendMessage(message.channel, `<@${message.author.id}>, you've already guessed :regional_indicator_${letter}: !`);
                return;
            }
            // Check the guess and update the game
            const guessResult = this.guess(letter);
            this.update(message, {
                letter: letter,
                from: 'guess',
                correct: guessResult
            });
        }
        if(message.content.toLowerCase() === 'i give up') {
            this.collector.stop('GAVE_UP');
        }
        if(message.content.toLowerCase() === 'hint') {
            if(!this.usedHint) {
                // Reveal a letter and update the game
                const revealedLetter = this.useHint();
                this.update(message, {
                    letter: revealedLetter,
                    from: 'hint'
                });
            } else {
                // They've already used their hint
                await this.sendMessage(message.channel, `<@${message.author.id}>, you've already used up your hint for this game! No more hints! :angry:`);
            }
        }
        if(message.content.toLowerCase().startsWith('guess word ')) {
            let guess = message.content.substr('guess word '.length, message.content.length).trim();
            if(this.guessWord(guess)) {
                await this.collector.stop('WON');
            } else {
                this.update(message, {
                    guess: guess
                });
            }
        }
        if(message.content.toLowerCase() === '?hint' && message.member.hasPermission('ADMINISTRATOR')) {
            await this.sendMessage(message.channel, `Hint generated: ${this.useHint()}`);
        }
        if(message.content.toLowerCase() === '?word' && message.member.hasPermission('ADMINISTRATOR')) {
            await this.sendMessage(message.channel, `The word is: ${this.word}`);
        }
        if(message.content.toLowerCase() === '?state' && message.member.hasPermission('ADMINISTRATOR')) {
            const reply = `**Word:** ${this.word}\n**Guessed letters:** ${this.guessedLetters}\n**Lives left:** ${this.livesLeft}\n**Hint used:** ${this.usedHint}`;
            await this.sendMessage(message.channel, reply);
        }
    }

    guess(letter) {
        letter = letter.toLowerCase();
        this.guessedLetters.push(letter);
        if(this.word.toLowerCase().indexOf(letter.toLowerCase()) > -1) return true;
        this.livesLeft -= 1;
        return false;
    }

    guessWord(word) {
        if(word.toLowerCase() === this.word.toLowerCase()) {
            return true;
        } else {
            this.livesLeft -= 1;
            return false;
        }
    }

    useHint() {
        this.usedHint = true;
        const lettersInWord = this.word.toLowerCase().split('').filter(letter => {
            return this.guessedLetters.indexOf(letter) < 0;
        });
        if(lettersInWord.length < 1) return;
        const letter = lettersInWord[chance.integer({ min: 0, max: lettersInWord.length - 1})];
        this.guessedLetters.push(letter);
        return letter;
    }

    calculateScore() {
        const rawScore = Math.ceil(50 + (this.livesLeft * 2 + (8 * (this.word.length / 2))));
        if(this.usedHint) {
            return Math.ceil(rawScore * 0.75);
        } else {
            return rawScore;
        }
    }

    async saveResult(score) {
        let totalScore = score;
        let gamesPlayed = 1;
        try {
            const existingPlayerRecord = await Hangman.findOne({ guildId: this.guildID, memberId: this.initiatingMemberID }, 'gamesPlayed totalScore').exec();
            if(existingPlayerRecord) {
                totalScore = totalScore + existingPlayerRecord.totalScore;
                gamesPlayed = existingPlayerRecord.gamesPlayed + 1;
            }
            const playerRecord = await Hangman.findOneAndUpdate({ guildId: this.guildID, memberId: this.initiatingMemberID }, {
                totalScore: totalScore,
                gamesPlayed: gamesPlayed,
                $push: {
                    scores: score
                }
            }, { new: true, upsert: true });
        } catch(err) {
            console.error(err);
        }
    }

    async update(message, lastAction) {
        if(this.messageWaiting) return;
        this.messageWaiting = true;
        let description = `React with :grey_question: for instructions, :mag_right: for a hint or :flag_white: to give up`;
        if(lastAction) {
            if(lastAction.from === 'hint') {
                description = `:sparkles: **Your hint revealed the letter :regional_indicator_${lastAction.letter.toLowerCase()}:!** :sparkles:`;
            }
            if(lastAction.from === 'guess') {
                if(lastAction.correct) {
                    description = `:white_check_mark: **Nice! :regional_indicator_${lastAction.letter.toLowerCase()}: was in the word!**`
                } else {
                    description = `:x: **Sorry, :regional_indicator_${lastAction.letter.toLowerCase()}: isn't in the word. ${this.livesLeft} guesses left!**`
                }
            }
            if(lastAction.guess) {
                description = `:x: **Sorry, the word isn't '${lastAction.guess}', you've got ${this.livesLeft} guesses left!**`
            }
            if(lastAction.resume) {
                description = `:wave: Welcome back, <@${message.author.id}>! I've resumed your previous game.`;
            }
        }
        const wordAsArray = this.word.split('');
        let word = `${this.word.length} `;
        let lives = `${this.livesLeft} `;
        let lettersGuessed;
        let hintStatus;
        let correctLetters = 0;
        
        for(let i = 0; i < wordAsArray.length; i++) {
            let letter = wordAsArray[i];
            if(this.guessedLetters.indexOf(letter.toLowerCase()) > -1) {
                word += `:regional_indicator_${letter.toLowerCase()}: `;
                correctLetters++;
            } else {
                word += this.placeholders.unrevealedLetter + ' ';
            }
        }

        for(let i = 0; i < this.livesLeft; i++) {
            lives += ':blue_heart: '
        }

        for(let i = 0; i < this.startingLives - this.livesLeft; i++) {
            lives += ':black_heart: '
        }

        for(let i = 0; i < this.guessedLetters.length; i++) {
            if(!lettersGuessed) {
                lettersGuessed = `**${this.guessedLetters[i].toUpperCase()}** `;
            } else {
                lettersGuessed += `**${this.guessedLetters[i].toUpperCase()}** `;
            }
        }

        if(correctLetters === this.word.length) {
            // They won!
            this.collector.stop('WON');
            return;
        }

        if(this.livesLeft === 0) {
            // They lost!
            this.collector.stop('LOST');
            return;
        }

        if(this.lastMessageID) {
            try {
                const lastMessage = await message.channel.messages.fetch(this.lastMessageID);
                lastMessage.delete();
            } catch(err) {
                console.error(err);
            }
        }

        hintStatus = (this.usedHint) ? "Hint used" : "Hint available";
        const reply = messageBuilder.embed(description, {
            title: `${message.author.username}'s hangman game`,
            fields: [
                ['Word', word],
                ['Guesses left', lives, true],
                ['Letters guessed', lettersGuessed || 'None yet', true],
            ],
            footer: hintStatus,
            thumbnail: this.avatarURL
        });
        const sentMessage = await this.sendMessage(message.channel, reply);
        this.messageWaiting = false;
        this.lastMessageID = sentMessage.id;
        this.lastSentMessage = sentMessage;
        sentMessage.react('❔');
        if(!this.usedHint) {
            sentMessage.react('🔎');
        }
        sentMessage.react('🏳️');
        const reactionFilter = (reaction, user) => user.id === this.initiatingMemberID;
        const reactionCollector = sentMessage.createReactionCollector(reactionFilter, { time: 90000 });
        reactionCollector.on('collect', async (reaction, user) => {
            if(reaction.emoji.name === '❔') {
                const reply = '**__How to play hangman__**\n' +
                            '1. Guess a letter by saying that letter, e.g. **B**\n' +
                            '2. Guess the whole word by saying **guess word** *word*, e.g. **guess word tremor**\n' +
                            '3. If you get stuck, you can reveal a letter by saying **hint** or reacting :mag_right: but your final score will be lower\n' +
                            '4. Want to give up? Just say **I give up** or react :flag_white: \n\n' +
                            'If you don\'t take any action within 90 seconds, the game will sleep until you resume it. Longer words are worth more points! You can choose the length of the word, just add a number to the command like .hangman **5**';
                await this.sendMessage(message.channel, reply);
            }
            if(reaction.emoji.name === '🔎' && !this.usedHint) {
                if(!this.usedHint) {
                    // Reveal a letter and update the game
                    const revealedLetter = this.useHint();
                    this.update(this.message, {
                        letter: revealedLetter,
                        from: 'hint'
                    });
                } else {
                    // They've already used their hint
                    await this.sendMessage(message.channel, `<@${message.author.id}>, you've already used up your hint for this game! No more hints! :angry:`);
                }
            }
            if(reaction.emoji.name === '🏳️') {
                this.collector.stop('GAVE_UP');
            }
        });
    }

    resume(message) {
        this.update(message, {
            lastAction: 'resume'
        })
        const filter = (m) => m.author.id === this.initiatingMemberID;
        this.collector = message.channel.createMessageCollector(filter, { time: 90000 })
        this.collector.on('collect', message => {
            this.messageHandler(message);
        });
        this.collector.on('end', async (collected, reason) => {
            await this.end(reason);
        });
    }

    start(message) {
        this.update(message);
        const filter = (m) => m.author.id === this.initiatingMemberID;
        this.collector = message.channel.createMessageCollector(filter, { time: 90000 })
        this.collector.on('collect', message => {
            this.messageHandler(message);
        });
        this.collector.on('end', async (collected, reason) => {
            await this.end(reason);
        });
    }

    async end(reason) {
        this.lastSentMessage.reactions.removeAll().catch(err => console.error(err));
        switch(reason) {
            case "GAVE_UP":
                await this.saveResult(0);
                await this.sendMessage(this.message.channel, `Giving up so soon, <@${this.initiatingMemberID}>? Well, the word was **${this.word}**!`);
                await this.sendMessage(this.message.channel, `:question: Was this word too difficult, obscure or not really one word? Send **.flagword ${this.word}** to flag it for removal from my database.`);
            break;

            case "LOST":
                await this.saveResult(0);
                await this.sendMessage(this.message.channel, `Oh no <@${this.initiatingMemberID}>, you're out of lives :frowning2: that was a tough one, but I can tell you the word was **${this.word}** ! Better luck next time.`);
                await this.sendMessage(this.message.channel, `:question: Was this word too difficult, obscure or not really one word? Send **.flagword ${this.word}** to flag it for removal from my database.`);
            break;

            case "WON":
                const score = this.calculateScore();
                await this.saveResult(score);
                await this.sendMessage(this.message.channel, `:partying_face: Yay <@${this.initiatingMemberID}>, you got the word: **${this.word}**! Well done. You've scored **${score}** points, and you solved it with ${this.livesLeft} guesses remaining :partying_face:`);
            break;

            case "time":
                await this.sendMessage(this.message.channel, `Hey <@${this.initiatingMemberID}>, your hangman game has gone to sleep due to inactivity. You can start it again with .hangman`);
            break;
        }
        if(reason === 'time') {
            const game = await activeGames.get(`${this.guildID}.${this.initiatingMemberID}`);
            await sleepingGames.set(`${this.guildID}.${this.initiatingMemberID}`, game);
        }
        await activeGames.delete(`${this.guildID}.${this.initiatingMemberID}`);
    }
}

async function isAlreadyPlaying(guildID, memberID) {
    const isAlreadyPlaying = await activeGames.get(`${guildID}.${memberID}`);
    return typeof isAlreadyPlaying !== 'undefined';
}

async function hasSleepingGame(guildID, memberID) {
    const hasSleepingGame = await sleepingGames.get(`${guildID}.${memberID}`);
    return typeof hasSleepingGame !== 'undefined';    
}

async function execute(message, args) {
    if(await isAlreadyPlaying(message.guild.id, message.author.id)) {
        message.channel.send(`Hey <@${message.author.id}>, you're already playing a game of hangman! If you want to quit your current game, just say 'I give up'`);
        return;
    }
    if(await hasSleepingGame(message.guild.id, message.author.id)) {
        const sleepingGame = await sleepingGames.get(`${message.guild.id}.${message.author.id}`);
        await activeGames.set(`${message.guild.id}.${message.author.id}`, sleepingGame);
        await sleepingGames.delete(`${message.guild.id}.${message.author.id}`);
        const game = await activeGames.get(`${message.guild.id}.${message.author.id}`);
        game.resume(message);
        return;
    }
    try {
        let wordLength = false;
        const words = cache.get('words');
        if(args[0] && !isNaN(args[0])) {
            if(args[0] < words.$shortest) {
                message.channel.send(`Sorry <@${message.author.id}>, the shortest word length you can choose is **${words.$shortest}** - wouldn't be fun if it was *too* easy!`);
                return;
            }
            if(args[0] > words.$longest) {
                message.channel.send(`Sorry <@${message.author.id}>, the longest word length you can choose is **${words.$longest}** (that's enough of a challenge, right?)`);
                return;
            }
            wordLength = args[0];
        }
        const randomLength = wordLength || chance.integer({ min: words.$shortest, max: words.$longest });
        const randomWord = chance.integer({ min: 0, max: words[randomLength].length - 1 });
        const word = words[randomLength][randomWord];
        console.log('The word is: ' + word);
        const game = new HangmanGame(message, word);
        await activeGames.set(`${message.guild.id}.${message.author.id}`, game);
        game.start(message);
    } catch(err) {
        console.error(err);
        throw err;
    }
}

module.exports = {
	name: 'hangman',
    description: 'Start a new game of hangman',
    usage: '[word length] *Optional: choose the length of the word to guess*',
	execute: execute
};