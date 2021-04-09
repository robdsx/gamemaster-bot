const cache = require('../cache');
const messageBuilder = require('../helpers/message-builder');

function execute(message, args) {
    const response = [];
    const { commands } = message.client;
    if(!args.length) {
        response.push("Here's a list of all my commands:\n**");
        response.push(commands.map(command => command.name).join(', '));
        response.push(`\n**To get information about a specific command, send ${cache.get('guilds')[message.guild.id].prefix}help [command name]`);
        return message.channel.send(messageBuilder.embed(response));
    }

    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName) || commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if(!command) {
        return message.channel.send(messageBuilder.embed(`${commandName} isn't a valid command.`, { template: 'warning' }));
    }

    response.push(command.description);

    responseData = {
        template: 'info',
        title: command.name,
        fields: []
    }

    if(command.aliases) responseData.fields.push(['Aliases', command.aliases.join(', ')]);
    if(command.usage) responseData.fields.push(['Usage', command.usage]);

    message.channel.send(messageBuilder.embed(response, responseData));
}

module.exports = {
	name: 'help',
	description: 'List all bot commands or get information about a specific command.',
    aliases: ['commands', 'h'],
    usage: '[command name]',
	execute: execute
};