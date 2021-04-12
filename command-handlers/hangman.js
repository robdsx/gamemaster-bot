const Discord = require('discord.js');
const Hangman = require('../models/hangman');
const Word = require('../models/word');
const leaderboard = require ('./leaderboard');
const { update } = require('../models/word');
const cache = require('../cache');
const messageBuilder = require('../helpers/message-builder');
const Chance = require('chance');
const chance = new Chance();

const games = {};

class HangmanGame {

    static gameMessages = {
        GAME_STARTED: 'Say a letter to guess that letter\n**.hangman guess [word]** to guess the full word\n**.hangman hint** to reveal a letter\n**.hangman surrender** to give up\nUsing a hint will lower your final score!',
        GAME_LETTER_CORRECT: ':white_check_mark: **Nice! :regional_indicator_{{letter}}: was in the word!**',
        GAME_LETTER_INCORRECT: ':x: **Sorry, :regional_indicator_{{letter}}: isn\'t in the word. {{guesses}} guesses left!**',
        GAME_LETTER_HINT: ':sparkles: **Your hint revealed the letter :regional_indicator_{{letter}}:!** :sparkles:',
        GAME_LETTER_ALREADY_GUESSED: '<@{{player}}>, you\'ve already guessed :regional_indicator_{{letter}}: !',
        GAME_WORD_GUESS_INCORRECT: ':x: **Sorry, the word isn\'t \'{{word}}\', you\'ve got {{guesses}} guesses left!**',
        GAME_HINT_ALREADY_USED: '<@{{player}}>, you\'ve already used up your hint for this game! No more hints! :angry:',
        GAME_GIVE_UP: 'Giving up so soon, <@{{player}}>? The word was **{{word}}**!',
        GAME_WON: ':partying_face: Yay <@{{player}}>, you got the word: **{{word}}**! Well done. You\'ve scored **{{score}}** points, and you solved it with {{guesses}} guesses remaining :partying_face:',
        GAME_LOST: 'Oh no <@{{player}}>, you\'re out of lives :frowning2: that was a tough one, but I can tell you the word was **{{word}}** ! Better luck next time.',
        GAME_SLEEP: 'Hey <@{{player}}>, your hangman game has gone to sleep due to inactivity :sleeping: you can start it again with **.hangman**',
        GAME_RESUME: 'Welcome back <@{{player}}>! You didn\'t finish your last game, so I saved it for you. Here\'s the story so far...',
        WORD_SURVEY: ':question: Was this word too difficult, obscure or not really one word? Send **.flagword {{word}} to flag it for removal from my database.',
    }

    static gameCommands = {
        GAME_GIVE_UP: 'surrender',
        GAME_USE_HINT: 'hint',
        GAME_GUESS_WORD: 'guess'
    }

    constructor(startingMessage, wordToGuess, isMultiPlayerGame = false) {
        this.startingMessage = startingMessage;
        this.lastBotMessage = false;
        this.startingPlayer = this.startingMessage.author;
        this.word = wordToGuess;
        this.isMultiPlayerGame = isMultiPlayerGame;
        this.guessedLetters = [];
        this.guessesAtStart = 7;
        this.guessesLeft = this.guessesAtStart;
        this.hintUsed = false;
        this.enableWordSurvey = true;
        this.gameTimeout = 90000;
        this.isSleeping = false;
        this.enableReactions = false;
        this.state = {
            action: 'GAME_STARTED'
        }
        this.placeholders = {
            GUESS_AVAILABLE: ':blue_heart:',
            GUESS_USED: ':black_heart:',
            UNREVEALED_LETTER: ':white_large_square:'
        }
        console.log('The word is: ' + this.word);
    }

    // startGame() is called once and sets up the message collector
    async startGame(message = false) {
        // Is this a sleeping game being resumed?
        if(this.isSleeping && message) {
            this.startingMessage = message;
            this.startingPlayer = message.author;
            this.lastBotMessage = false;
            this.isSleeping = false;
            this.state.action = 'GAME_RESUME';
        }

        // Filter for the message collector so we only handle messages from the player in the correct channel
        const messageFilter = (message) => {
            return(message.author.id === this.startingPlayer.id && message.channel.id === this.startingMessage.channel.id);
        }

        // Create message collector to pick up the player's input, with the specified timeout
        this.messageCollector = this.startingMessage.channel.createMessageCollector(messageFilter, { time: this.gameTimeout });
            

        // Collect event handles incoming messages that match the filter
        this.messageCollector.on('collect', async message => {
            // Reset the collector timeout
            this.messageCollector.resetTimer(this.gameTimeout);
            // Handle the input
            await this.handleInput(message);
        });

        // End event handles timeout and user-initiated endings (giving up, won, lost)
        this.messageCollector.on('end', async (collected, reason) => {
            // Game has timed out, put it to sleep
            if(reason === 'time') {
                await this.handleInput('sleep');
                return;
            }
        });

        // Send the starting message
        await this.sendUpdate();
    }

    // endGame() handles all the ways a game can end
    async endGame() {
        if(this.messageCollector) await this.messageCollector.stop();
        if(this.reactionCollector) await this.reactionCollector.stop();
        await this.deleteLastMessage();
        let reply = '';
        let score = 0;
        switch(this.state.action) {
            case 'GAME_WON':
                score = this.getScore();
                reply = messageBuilder.template(HangmanGame.gameMessages.GAME_WON, {
                    player: this.startingPlayer.id,
                    word: this.word,
                    score: score,
                    guesses: this.guessesLeft
                });
            break;

            case 'GAME_LOST':
                reply = messageBuilder.template(HangmanGame.gameMessages.GAME_LOST, {
                    player: this.startingPlayer.id,
                    word: this.word
                });
            break;

            case 'GAME_GIVE_UP':
                reply = messageBuilder.template(HangmanGame.gameMessages.GAME_GIVE_UP, {
                    player: this.startingPlayer.id,
                    word: this.word
                });
            break;
        }
        await this.saveResult(score);
        await this.startingMessage.channel.send(reply);
        delete games[`${this.startingMessage.guild.id}.${this.startingPlayer.id}`];
    }

    // sendUpdate() is called after each interaction to send an updated message to the player
    async sendUpdate() {
        let parsedTemplate;
        let message;

        // Check if the last action was an invalid interaction
        if(this.state.action === 'GAME_HINT_ALREADY_USED' || this.state.action === 'GAME_LETTER_ALREADY_GUESSED') {
            let reply;
            if(this.state.action === 'GAME_HINT_ALREADY_USED') {
                reply = messageBuilder.template(HangmanGame.gameMessages.GAME_HINT_ALREADY_USED, { player: this.startingPlayer.id });
            }
            if(this.state.action === 'GAME_LETTER_ALREADY_GUESSED') {
                reply = messageBuilder.template(HangmanGame.gameMessages.GAME_LETTER_ALREADY_GUESSED, {
                    player: this.startingPlayer.id,
                    letter: this.state.input
                });
            }
            await this.startingMessage.channel.send(reply);
            return;
        }

        // Check if we're going to sleep
        if(this.state.action === 'GAME_SLEEP') {
            let reply = messageBuilder.template(HangmanGame.gameMessages.GAME_SLEEP, {
                player: this.startingPlayer.id,
            });
            await this.startingMessage.channel.send(reply);
            return;
        }

        const gameTemplate = messageBuilder.embed().setTitle(`${this.startingPlayer.username}'s hangman game`).setThumbnail(this.startingPlayer.avatarURL());

        switch(this.state.action) {
            // The game has just started
            case 'GAME_RESUME':
                gameTemplate.setDescription(messageBuilder.template(HangmanGame.gameMessages.GAME_RESUME, {
                    player: this.startingPlayer.id
                }));
            break;

            case 'GAME_STARTED':
                gameTemplate.setDescription(HangmanGame.gameMessages.GAME_STARTED);
            break;

            // A letter was correctly guessed
            case 'GAME_LETTER_CORRECT':
                gameTemplate.setDescription(messageBuilder.template(HangmanGame.gameMessages.GAME_LETTER_CORRECT, {
                    letter: this.state.input.toLowerCase()
                }));
            break;

            case 'GAME_LETTER_INCORRECT':
                gameTemplate.setDescription(messageBuilder.template(HangmanGame.gameMessages.GAME_LETTER_INCORRECT, {
                    letter: this.state.input.toLowerCase(),
                    guesses: this.guessesLeft
                }));
            break;

            case 'GAME_LETTER_HINT':
                gameTemplate.setDescription(messageBuilder.template(HangmanGame.gameMessages.GAME_LETTER_HINT, {
                    letter: this.state.input.toLowerCase()
                }));
            break;

            case 'GAME_WORD_GUESS_INCORRECT':
                gameTemplate.setDescription(messageBuilder.template(HangmanGame.gameMessages.GAME_WORD_GUESS_INCORRECT, {
                    word: this.state.input.toLowerCase(),
                    guesses: this.guessesLeft
                }));
            break;
        }

        const lettersInWord = this.word.split('');
        let wordState = `${this.word.length} `;
        let guessesState = `${this.guessesLeft} `;
        let guessedLettersState = false;
        let hintState = (this.hintUsed) ? 'Hint used' : 'Hint available';

        // Assemble the word field
        for(let i = 0; i < lettersInWord.length; i++) {
            let letter = lettersInWord[i];
            if(this.guessedLetters.indexOf(letter.toLowerCase()) > -1) {
                wordState += `:regional_indicator_${letter.toLowerCase()}: `;
            } else {
                wordState += this.placeholders.UNREVEALED_LETTER + ' ';
            }
        }

        // Assemble the guesses field
        for(let i = 0; i < this.guessesLeft; i++) {
            guessesState += this.placeholders.GUESS_AVAILABLE + ' ';
        }

        for(let i = 0; i < this.guessesAtStart - this.guessesLeft; i++) {
            guessesState += this.placeholders.GUESS_USED + ' ';
        }

        // Assemble the guessed letters field
        for(let i = 0; i < this.guessedLetters.length; i++) {
            if(!guessedLettersState) {
                guessedLettersState = `**${this.guessedLetters[i].toUpperCase()}** `;
            } else {
                guessedLettersState += `**${this.guessedLetters[i].toUpperCase()}** `;
            }
        }

        if(!guessedLettersState) guessedLettersState = 'None yet'

        // Add the fields to the game message template
        gameTemplate.addFields(
            { name: 'Word', value: wordState },
            { name: 'Guesses left', value: guessesState, inline: true },
            { name: 'Letters guessed', value: guessedLettersState, inline: true }
        );

        // Set the game message footer
        gameTemplate.setFooter(hintState);

        // Delete the old game message (if any), and send the new one
        await this.deleteLastMessage();
        //this.lastBotMessage = await this.startingMessage.channel.send(gameTemplate);

        this.lastBotMessage = await this.startingMessage.channel.send(gameTemplate);
        // Add reacts and set up the reaction collector
        if(this.enableReactions) {
            await message.react('❔');
            await message.react('🔎');
            if(message.channel.messages.fetch(this.lastMessageID)) await message.react('🏳️');
            const reactionCollectorFilter = (reaction, user) => user.id === this.startingPlayer.id;
            this.reactionCollector = this.lastBotMessage.createReactionCollector(reactionCollectorFilter, { time: this.gameTimeout });
            this.reactionCollector.on('collect', async (reaction, user) => {
                // Send 'how to play' info
                if(reaction.emoji.name === '❔') {
                    const reply = '**__How to play hangman__**\n' +
                                '1. Guess a letter by saying that letter, e.g. **B**\n' +
                                '2. Guess the whole word by saying **guess word** *word*, e.g. **guess word tremor**\n' +
                                '3. If you get stuck, you can reveal a letter by saying **hint** or reacting :mag_right: but your final score will be lower\n' +
                                '4. Want to give up? Just say **I give up** or react :flag_white: \n\n' +
                                'If you don\'t take any action within 90 seconds, the game will sleep until you resume it. Longer words are worth more points! You can choose the length of the word, just add a number to the command like .hangman **5**';
                    await this.startingMessage.channel.send(messageBuilder.embed(reply));
                }
                // Use hint
                if(reaction.emoji.name === '🔎') {
                    this.handleInput(HangmanGame.gameCommands.GAME_USE_HINT);
                }
                // Give up the game
                if(reaction.emoji.name === '🏳️') {
                    this.handleInput(HangmanGame.gameCommands.GAME_GIVE_UP);
                }
            });
        }  
    }

    // handleInput() handles incoming interactions, decides what's happening, updates the state and calls sendUpdate() if needed
    async handleInput(message) {
        let messageContent = message.content || message;
        let validInput = false;
        // Single letter guess
        if(messageContent.length === 1) {
            const letter = messageContent.toLowerCase();
            // Check if this is really a letter
            if(!letter.match(/[a-z]/i)) {
                return;
            }
            this.state.input = letter;
            // Have they already guessed this letter?
            if(this.guessedLetters.indexOf(letter) > -1) {
                this.state.action = 'GAME_LETTER_ALREADY_GUESSED';
            } else {
                // Add to guessed letters and to state
                this.guessedLetters.push(letter);
                // Check if it's in the word
                if(this.word.toLowerCase().indexOf(letter.toLowerCase()) > -1) {
                    // It is!
                    this.state.action = 'GAME_LETTER_CORRECT';
                } else {
                    // It isn't :(
                    this.guessesLeft -= 1;
                    this.state.action = 'GAME_LETTER_INCORRECT';
                }
            }
            validInput = true;
        }

        // Use hint
        if(messageContent.toLowerCase() === HangmanGame.gameCommands.GAME_USE_HINT) {
            // Have they already used their hint?
            if(this.hintUsed) {
                // You only get one
                this.state.action = 'GAME_HINT_ALREADY_USED';
            } else {
                // Let's grab a random letter for them
                this.hintUsed = true;
                this.state.action = 'GAME_LETTER_HINT';
                const lettersInWord = this.word.toLowerCase().split('').filter(letter => {
                    return this.guessedLetters.indexOf(letter) < 0;
                });
                if(lettersInWord.length < 1) return;
                const letter = lettersInWord[chance.integer({ min: 0, max: lettersInWord.length - 1})];
                this.guessedLetters.push(letter);
                this.state.input = letter;
            }
            validInput = true;   
        }

        // Check if the word is complete and they've won!
        let word = this.word.toLowerCase();
        for(let i = 0; i < this.guessedLetters.length; i++) {
            word = word.replace(new RegExp(this.guessedLetters[i].toLowerCase(), 'g'), '');
        }
        if(word.length === 0) {
            this.state.action = 'GAME_WON';
            this.endGame();
            return;
        }

        // Guess word?
        if(messageContent.split(' ').length > 1) {
            const messageParts = messageContent.split(' ');
            // Guessing the word
            if(messageParts[0].toLowerCase() === HangmanGame.gameCommands.GAME_GUESS_WORD && messageParts.length === 2) {
                if(messageParts[1].toLowerCase() === this.word.toLowerCase()) {
                    // They got it!
                    this.state.action = 'GAME_WON'; 
                    this.state.input = messageParts[1].toLowerCase();
                    await this.endGame();
                    return;
                } else {
                    // Nope, that's not it...
                    this.guessesLeft -= 1;
                    this.state.action = 'GAME_WORD_GUESS_INCORRECT';
                    this.state.input = messageParts[1].toLowerCase();
                }
                validInput = true;
            }       
        }

        // Giving up
        if(messageContent === HangmanGame.gameCommands.GAME_GIVE_UP) {
            this.state.action = 'GAME_GIVE_UP';
            this.endGame();
            return;
        } 

        // Is the game going to sleep?
        if(messageContent === 'sleep') {
            this.isSleeping = true;
            this.state.action = 'GAME_SLEEP';
            validInput = true;
            if(this.reactionCollector) this.reactionCollector.stop();
            await this.deleteLastMessage();
        }

        if(!validInput) return;

        // But wait...are they out of guesses?
        if(this.guessesLeft === 0) {
            this.state.action = 'GAME_LOST';
            this.endGame();
            return;
        }

        // Phew, that was a lot of stuff to handle. Time to let sendUpdate() take over and make a cup of tea
        await this.sendUpdate();
    }

    // Deletes the last game message sent by the bot
    async deleteLastMessage() {
        if(this.reactionCollector) this.reactionCollector.stop();
        if(this.lastBotMessage) {
            const lastMessage = await this.startingMessage.channel.messages.fetch(this.lastBotMessage.id);
            lastMessage.delete();
        }
    }

    // Calculates the player's score
    getScore() {
        const baseScore = 50;
        const lettersUnrevealedBonus = 8 * (this.word.length - this.guessedLetters.length);
        const hintNotUsedBonus = (this.hintUsed) ? 0 : 25;
        const wordLengthBonus = 4 * (this.word.length - 5);
        return baseScore + lettersUnrevealedBonus + hintNotUsedBonus + wordLengthBonus;
    }

    // Saves the game result to the database
    async saveResult(score) {
        let totalScore = score;
        let gamesPlayed = 1;
        try {
            const existingPlayerRecord = await Hangman.findOne({ guildId: this.startingMessage.guild.id, memberId: this.startingMessage.author.id }, 'gamesPlayed totalScore').exec();
            if(existingPlayerRecord) {
                totalScore = totalScore + existingPlayerRecord.totalScore;
                gamesPlayed = existingPlayerRecord.gamesPlayed + 1;
            }
            const playerRecord = await Hangman.findOneAndUpdate({ guildId: this.startingMessage.guild.id, memberId: this.startingMessage.author.id }, {
                totalScore: totalScore,
                gamesPlayed: gamesPlayed,
                $push: {
                    games: {
                        won: (score > 0) ? true : false,
                        score: score,
                        word: this.word 
                    }
                }
            }, { new: true, upsert: true });
        } catch(err) {
            console.error(err);
        }
    }

    static async getPlayerDetails(guild, user) {
        let reply = '';
        const playerRecord = await Hangman.findOne({ guildId: guild, memberId: user }, {
            gamesPlayed: 1,
            totalScore: 1,
            games: 1
        }).exec();
        if(!playerRecord) return false;
        let latestGameResults = '';
        for(let i = 0; i < playerRecord.games.length; i++) {
            if(playerRecord.games[i].won) {
                latestGameResults += ':white_check_mark: ';
            } else {
                latestGameResults += ':x: ';
            }
        }
        const gamesWonPercentage = (playerRecord.gamesWonLost.won / playerRecord.gamesPlayed) * 100;
        const gamesLostPercentage = (playerRecord.gamesWonLost.lost / playerRecord.gamesPlayed) * 100;
        return {
            gamesPlayed: playerRecord.gamesPlayed,
            gamesWon: playerRecord.gamesWonLost.won,
            gamesWonPercentage: gamesWonPercentage.toFixed(1),
            gamesLost: playerRecord.gamesWonLost.lost,
            gamesLostPercentage: gamesLostPercentage.toFixed(1),
            totalScore: playerRecord.totalScore,
            averageScore: playerRecord.averageScore,
            latestGameResults: latestGameResults,
        }
    }
}

async function getStats(message, args = [], client) {
    let user = message.author;
    let guild = message.guild.id;
    let reply = '';
    if(args[0]) {
        const mentionedUser = messageBuilder.getUserFromMention(args[0], client);
        if(mentionedUser) {
            user = mentionedUser;
        }
    }
    const playerRecord = await HangmanGame.getPlayerDetails(guild, user.id);
    if(!playerRecord) {
        reply = `It looks like **${user.username}** hasn't played any games of Hangman yet...`;
    } else {
        reply = messageBuilder.embed('', {
            title: `${user.username}'s hangman stats`,
            thumbnail: user.avatarURL(),
            fields: [
                ['Games played', playerRecord.gamesPlayed, true],
                ['Games won', `${playerRecord.gamesWon} (${playerRecord.gamesWonPercentage}%)`, true],
                ['Games lost', `${playerRecord.gamesLost} (${playerRecord.gamesLostPercentage}%)`, true],
                ['Total score', playerRecord.totalScore, true],
                ['Average score', playerRecord.averageScore, true],
                ['Latest game results', playerRecord.latestGameResults]
            ]
        });
    }
    await message.channel.send(reply);
}

async function getLeaderboard(message) {
    await leaderboard.execute(message, ['hangman']);
}

async function execute(message, args, client) {
    // Get leaderboard
    if(args[0] === 'leaderboard') {
        await getLeaderboard(message);
        return;
    }
    // Get stats
    if(args[0] === 'stats') {
        args.shift();
        await getStats(message, args, client);
        return;
    }
    if(args[0] === 'help') {
        const description = 'The goal is to guess the word. You\'ll be able to see how many letters are in the word.\n\n' +
                        '- You can guess which letter might be in the world by just typing the letter, e.g. **g**\n\n' +
                        '- If you think you know the entire word, you can guess the whole word using **.hangman guess [word]**\n\n' +
                        '-If you get stuck, you can reveal a letter using your hint: **.hangman hint**\n\n' +
                        '- You can end the game at any time by saying **.hangman surrender**, but it will be recorded as a loss\n\n' +
                        'The less guesses you need to get the word, the higher your score. Longer words are worth more points. Using a hint will lower your final score!\n\n' +
                        'You can see the leaderboard with **.leaderboard**, and your personal stats with **.hangman stats** (or someone else\'s with **.hangman stats @User**';
        const reply = messageBuilder.embed(description, {
            title: 'How to play Hangman'
        });
        message.channel.send(reply);
        return;
    }
    // Check if an existing game is running
    if(games.hasOwnProperty(`${message.guild.id}.${message.author.id}`)) {
        const existingGame = games[`${message.guild.id}.${message.author.id}`];
        // Is it a sleeping game that we can resume?
        if(existingGame.isSleeping) {
            existingGame.startGame(message);
            return;
        } else {
            if(args[0]) {
                // Is this a command for an existing game?
                if(args[0].toLowerCase() === HangmanGame.gameCommands.GAME_USE_HINT) {
                    await existingGame.handleInput(args[0]);
                    return;
                }
                if(args[0].toLowerCase() === HangmanGame.gameCommands.GAME_GUESS_WORD && args[1]) {
                    await existingGame.handleInput(`${args[0]} ${args[1]}`);
                    return;
                }
                if(args[0].toLowerCase() === HangmanGame.gameCommands.GAME_GIVE_UP) {
                    await existingGame.handleInput(`${args[0]}`);
                    return;
                }
            }
            message.channel.send(`<@${message.author.id}>, you're already playing a game of hangman! If you want to quit your current game, just say **.hangman surrender**`);
            return;
        }
    }
    // Start a new game
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
        const game = new HangmanGame(message, word);
        games[`${message.guild.id}.${message.author.id}`] = game;
        game.startGame();
    } catch(err) {
        console.error(err);
        throw err;
    }
}

module.exports = {
	name: 'hangman',
    description: 'Start a new game of hangman',
    aliases: ['hm'],
    usage: '[word length] *Optional: choose the length of the word to guess*\n**stats** [@User] *Get game stats for yourself or another user*\n**help** *Show detailed information on how to play*',
	execute: execute
};