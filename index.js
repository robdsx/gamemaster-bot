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
const guildModule = require('./modules/guild');
const guild = require('./modules/guild');
const embed = require('./modules/embed');

// Define who is a developer (and can use dev only commands)
const developers = ['770987624738455592'];

// Connect to database first, then do startup tasks
mongoose.connect(process.env.DB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, retryWrites: true })
    .then(console.log(`Connected to database`))
    .catch(err => {
        console.error(`Couldn't connect to database: ${err}`);
    })
    .then(async () => {
        // Cache loads some commonly used info from the database into memory
        console.log('Populating cache, this might take a while...');
        await cache.populate();
        console.log('Cache populated');  
    })
    .catch(err => {
        console.error(`Couldn't initialise cache: ${err}`);
    })
    .then(() => {
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
        console.error(`Startup error:`);
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
        guildModule.register(guild);
    } catch(err) {
        console.error(`Couldn't create entry for guild ${guild.name} / ${guild.id} in the database: ${err}`);
    }
    console.log(`Bot added to server: ${guild.name}`);
});

// Client kicked/removed from guild (server) event handler
client.on('guildDelete', guild => {
    console.log(`Bot removed from server: ${guild.name}`);
});

// Client received message event handler
client.on('message', async message => {
    // What command prefix is this server using?
    let prefix = cache.guilds[message.guild.id].prefix;
    // If they forgot the prefix, respond to the default with a reminder
    if(message.content.startsWith('.prefixreminder')) {
        message.channel.send(embed.generate('generic', '', `My command prefix is set to **${prefix}**`));
        return;
    }
    // We're not interested in the message if it doesn't start with our prefix or is from another bot
    if(!message.content.startsWith(prefix) || message.author.bot) return;
    // Get an array of the args
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    // Respond to the 'help' command
    if(commandName === 'help' && args.length) {
        if(client.commands.has(args[0])) {
            message.channel.send(client.commands.get(args[0]).description);
        }
        return;
    }
    // Check if the command exists and invoke its handler if so (and the member has permission to)
    if(!client.commands.has(commandName)) return;
    try {
        let command = await client.commands.get(commandName);
        if(command.flags && command.flags.developerOnly && !developers.includes(message.member.id)) {
            message.channel.send(embed.generate('disallowed', 'Developers only', `Sorry <@${message.author.id}>, only my developers can use this command.`));
            return;
        }
        if(command.flags && command.flags.adminOnly && !message.member.hasPermission('ADMINISTRATOR')) {
            message.channel.send(embed.generate('disallowed', 'Administrators only', `Sorry <@${message.author.id}>, only administrators of this server can use this command.`));
            return;
        }
        await command.execute(message, args);
    } catch(err) {
        message.channel.send(embed.generate('error', commandName, "Sorry, I couldn't execute that command :sweat: please try again later."));
        if(cache.guilds[message.guild.id].lastErrors.length > 4) {
            cache.guilds[message.guild.id].lastErrors.shift();
        }
        cache.guilds[message.guild.id].lastErrors.push(err);
        console.error(`[${message.guild.id}/${commandName}]: Error executing command: ${err.name}`);
        console.error(err);
    }
});

process.on('unhandledRejection', error => {
	if(error.name === 'DiscordAPIError') return;
});