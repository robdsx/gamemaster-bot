require('dotenv').config();
require('log-timestamp');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const Discord = require('discord.js');
const client = new Discord.Client();
client.commands = new Discord.Collection();

// Load application modules
const cache = require('./cache');
const Guild = require('./models/guild');
const Word = require('./models/word');
const messageBuilder = require('./helpers/message-builder');

// Define who is a developer (and can use dev only commands)
const developers = ['770987624738455592'];

// Connect to database first, then do startup tasks
mongoose.connect(process.env.DB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, retryWrites: true })
    .then(async () => {
        console.log(`Connected to database`);
        // Load guild and word data into cache
        console.log('Populating cache...');
        cache.set('guilds', await Guild.cacheData());
        cache.set('words', await Word.cacheData());
        // Load command handlers
        const commandHandlers = fs.readdirSync('./command-handlers').filter(file => file.endsWith('.js'));
        for (const file of commandHandlers) {
            const command = require(`./command-handlers/${file}`);
            client.commands.set(command.name, command);
        }
        // Login!
        client.login(process.env.BOT_TOKEN);
    })
    .catch(err => {
        console.error(err);
    });

// Client ready event handler: triggered once on first successful connection
client.once('ready', () => {
    console.log('Connected to Discord');
});

// Client error event handler
client.on('error', err => {
    console.error(`Discord error: ${err}`);
});

// Client added to guild (server) event hander
client.on('guildCreate', async guild => {
    // Register the server, adding it to the database (if not already there)
    try {
        const newGuild = new Guild({
            guildID: guild.id
        });
        const savedGuild = await newGuild.save();
        console.log(`Bot added to server: ${guild.name} <${guild.id}>`);
        cache.get('guilds')[guild.id] = savedGuild;
    } catch(err) {
        console.error(`Couldn't create entry for guild ${guild.name} <${guild.id}> in the database: ${err}`);
    }
});

// Client kicked/removed from guild (server) event handler
client.on('guildDelete', guild => {
    console.log(`Bot removed from server: ${guild.name}`);
});

// Client received message event handler
client.on('message', async message => {
    // What command prefix is this server using?
    let prefix = cache.get('guilds')[message.guild.id].prefix;
    // If they forgot the prefix, respond to the default with a reminder
    if(message.content.startsWith('.?')) {
        message.channel.send(messageBuilder.embed(`My command prefix is set to **${prefix}**`, {
            template: 'generic'
        }));
        return;
    }
    // We're not interested in the message if it doesn't start with our prefix or is from another bot
    if(!message.content.startsWith(prefix) || message.author.bot) return;
    // Get an array of the args
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    // Check if the command exists and invoke its handler if so (and the member has permission to)
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if(!command) return;
    console.log(`Command is: ${command.name}, with args: ${args} [length: ${args.length}; contents: ${args[0]}]`);
    try {
        if(command.permissions) {
            const authorPermissions = message.channel.permissionsFor(message.author);
            let authorised = false;
            command.permissions.forEach(permission => {
                if(authorPermissions.has(permission)) {
                    authorised = true;
                }
            });
            if(!authorised) {
                message.channel.send(messageBuilder.embed(`Sorry <@${message.author.id}>, you can't use this command!`, {
                    template: 'disallowed',
                    title: 'Not allowed'
                    })
                );
                return;
            }
        }
        await command.execute(message, args, client);
    } catch(err) {
        message.channel.send(messageBuilder.embed("Sorry, I couldn't execute that command :sweat: please try again later.", {
            template: 'error',
            title: command.name,
            footer: err.name
        }));
        console.error(`[${message.guild.id}/${commandName}]: Error executing command: ${err.name}`);
        console.error(err);
    }
});

process.on('unhandledRejection', error => {
    if(error.name === 'DiscordAPIError') {
        console.warn(error);
        return;
    }
    console.error(error);
	if(error.name === 'DiscordAPIError');
});