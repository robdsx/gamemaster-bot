const Discord = require('discord.js');
const Hangman = require('../models/hangman');
const { update } = require('../models/word');
const Word = require('../models/word');
const embed = require('../modules/embed');

const activeGames = new Map();

class HangmanGame {
    constructor(message, word, options = {}) {
        this.lastBotMessageID = false;
        this.message = message;
        this.guildID = message.guild.id;
        this.initiatingMemberID = message.author.id;
        this.avatarURL = message.author.avatarURL();
        this.word = word;
        this.options = options;
        this.guessedLetters = [];
        this.startingLives = 6;
        this.livesLeft = 6;
        this.usedHint = false;
    }

    messageHandler(message) {
        this.collector.resetTimer({ time: 60000 });
        if(message.content.length === 1 && /^[a-zA-Z]/.test(message.content)) {
            let letter = message.content.toLowerCase();
            if(this.guessedLetters.indexOf(letter) > -1) {
                // Already guessed this letter
                message.channel.send(`<@${message.author.id}>, you've already guessed :regional_indicator_${letter}: !`);
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
                message.channel.send(`<@${message.author.id}>, you've already used up your hint for this game! No more hints! :angry:`);
            }
        }
        if(message.content.toLowerCase().startsWith('guess word ')) {
            let guess = message.content.substr('guess word '.length, message.content.length).trim();
            if(this.guessWord(guess)) {
                this.end('WON');
            } else {
                this.update(message, {
                    guess: guess
                });
            }
        }
    }

    guess(letter) {
        this.guessedLetters.push(letter.toLowerCase());
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
        const wordAsArray = this.word.split('');
        let remainingLetters = wordAsArray.filter((letter) => {
            return this.guessedLetters.indexOf(letter.toLowerCase()) < 0;
        });
        const i = Math.floor(Math.random() * wordAsArray.length)
        const revealedLetter = wordAsArray[i];
        this.guessedLetters.push(revealedLetter);
        return revealedLetter;
    }

    calculateScore() {
        const hintDeduction = (this.usedHint) ? 15 : 0;
        return Math.ceil(50 + (this.livesLeft * 2 + (8 * (this.word.length / 2))) - hintDeduction);
    }

    update(message, lastAction) {

        let description = `Welcome to hangman, <@${message.author.id}>!\n1. To guess, just type a letter e.g. 'B'\n2. If you think you know the word, say 'guess word [word]'\n3. If you're stuck, you can use a hint by saying 'hint', at the cost of a score penalty\n4. If you want to give up, just say 'I give up'\nIf you don't make a guess or use a hint within 1 minute, the game will end automatically.`;
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
        }
        const wordAsArray = this.word.split('');
        let word = ' ';
        let lives = ' ';
        let lettersGuessed;
        let hintStatus;
        let correctLetters = 0;
        
        for(let i = 0; i < wordAsArray.length; i++) {
            let letter = wordAsArray[i];
            if(this.guessedLetters.indexOf(letter.toLowerCase()) > -1) {
                word += `:regional_indicator_${letter.toLowerCase()}: `;
                correctLetters++;
            } else {
                word += ':white_large_square: ';
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

        hintStatus = (this.usedHint) ? "You've used your hint" : "Hint is available (just say 'hint'), but it'll lower your final score.";
        const reply = embed.generate('generic', `${message.author.username}'s hangman game`, description)
                        .addField('Word', word)
                        .addField('Guesses left', lives, true )
                        .addField('Letters guessed', lettersGuessed || 'None yet', true )
                        .setFooter(hintStatus)
                        .setThumbnail(this.avatarURL);
        message.channel.send(reply);
    }

    start(message) {
        this.update(message);
        const filter = (m) => m.author.id === this.initiatingMemberID;
        this.collector = message.channel.createMessageCollector(filter, { time: 60000 })
        this.collector.on('collect', message => {
            this.messageHandler(message);
        });
        this.collector.on('end', (collected, reason) => {
            this.end(reason);
        });
    }

    end(reason) {
        console.log('Hangman game ended: ' + reason);
        switch(reason) {
            case "GAVE_UP":
                this.message.channel.send(`Giving up so soon, <@${this.initiatingMemberID}>? Well, the word was **${this.word}**! Come back soon.`);
            break;

            case "LOST":
                this.message.channel.send(`Oh no <@${this.initiatingMemberID}>, you're out of lives :frowning2: that was a tough one, but I can tell you the word was **${this.word}** ! Better luck next time.`);
            break;

            case "WON":
                const score = this.calculateScore();
                this.message.channel.send(`:partying_face: Yay <@${this.initiatingMemberID}>, you got the word: **${this.word}**! Well done. You've scored **${score}** points, and you solved it with ${this.livesLeft} lives remaining :partying_face:`);
            break;

            case "time":
                this.message.channel.send(`Hey <@${this.initiatingMemberID}>, your hangman game has timed out due to inactivity.`);
            break;
        }
        activeGames.delete(`${this.guildID}.${this.initiatingMemberID}`);
    }
}

async function isAlreadyPlaying(guildID, memberID) {
    const isAlreadyPlaying = await activeGames.get(`${guildID}.${memberID}`);
    return typeof isAlreadyPlaying !== 'undefined';
}

async function execute(message, args) {
    if(await isAlreadyPlaying(message.guild.id, message.author.id)) {
        message.channel.send(`Hey <@${message.author.id}>, you're already playing a game of hangman! If you want to quit your current game, just say 'I give up'`);
        return;
    }
    try {
        const minWordLength = (Array.isArray(args) && args.length && !isNaN(parseInt(args[0]))) ? args[0] : 0;
        const word = await Word.random(minWordLength);
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
	description: embed.generate('generic', `:information_source: hangman`, 'Start a new game of hangman')
                    .addFields(
                        { name: 'Command', value: '.hangman' },
                        { name: 'Options', value: ':grey_question:**wordlength** *Specify the minimum length of the word to guess (minimum 5, maximum 15). The default is a random length between these two values.*'},
                    ),
	execute: execute
};