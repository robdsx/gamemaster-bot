const embed = require('../modules/embed');
const guild = require('../modules/guild');

async function execute(message, args) {
    let reply;
    if(!message.member.hasPermission("ADMINISTRATOR")) {
        reply = embed.generate('disallowed', 'Set prefix', `Sorry **${message.member.displayName}**, you need to be an administrator to use this command!`);
    }
    if(typeof args === 'undefined' || !args.length) {
        reply = embed.generate('incomplete', 'Set prefix', "Please specify what prefix to use, e.g. 'setprefix **?**'");
        message.channel.send(reply);
        return; 
    }
    if(args[0].length !== 1) {
        reply = embed.generate('warning', 'Set prefix', "That isn't a valid prefix, it must be a single character.");     
    }
    if(!reply) {
        let newPrefix = args[0];
        let result = await guild.setPrefix(message.guild.id, newPrefix);
        if(!result) {
            reply = embed.generate('error', 'Set prefix', "Sorry, I couldn't execute this command right now. Try again later.");
        } else {
            reply = embed.generate('success', 'Set prefix', `My command prefix has been updated to **${newPrefix}**`);
        }
    }
    message.channel.send(reply);
}

module.exports = {
	name: 'setprefix',
	description: embed.generate('generic', `:information_source: setprefix`, 'Set the prefix used to invoke commands')
                    .addFields(
                        { name: 'Command', value: '.setprefix' },
                        { name: 'Arguments', value: '**[Prefix]** *A single character to be used as the new prefix e.g. !*' },
                    ),
    flags: {
        adminOnly: true
    },
	execute: execute
};