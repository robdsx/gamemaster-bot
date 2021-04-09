const messageBuilder = require('../helpers/message-builder');
const Guild = require('../models/guild');
const cache = require('../cache');

async function execute(message, args) {
    let reply;
    if(typeof args === 'undefined' || !args.length) {
        reply = messageBuilder.embed("Please specify what prefix to use, e.g. 'setprefix **?**'", {
            template: 'incomplete',
            title: 'Set prefix'
        });
        await message.channel.send(reply);
        return; 
    }
    if(args[0].length > 2) {
        reply = messageBuilder.embed("The prefix must be no more than two characters long.", {
            template: 'warning',
            title: 'Set prefix'
        });
        await message.channel.send(reply);
        return; 
    }
    let newPrefix = args[0];
    const result = await Guild.setPrefix(message.guild.id, newPrefix);
    if(!result) {
        reply = messageBuilder.embed("Sorry, I couldn't change the prefix at the moment - try again later.", {
                    template: 'error',
                    title: 'Set prefix'
                });
    } else {
        const guild = cache.get('guilds');
        cache.set('guilds', guild[message.guild.id].prefix = result);
        reply = messageBuilder.embed(`My command prefix has been updated to **${newPrefix}**`, {
                    template: 'success',
                    title: 'Set prefix'
                });
    }
    message.channel.send(reply);
}

module.exports = {
	name: 'setprefix',
	description: 'Sets the prefix used to invoke the bot commands. The default is a period. A prefix must be no longer than two characters.',
    aliases: ['sp'],
    usage: 'setprefix [new prefix]',
    permissions: ['MANAGE_GUILD', 'ADMINISTRATOR'],
	execute: execute
};