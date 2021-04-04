const embed = require('../modules/embed');
const guild = require('../modules/guild');
const cache = require('../cache');

function debugCache(snowflake, cacheName) {
    if(cache[cacheName][snowflake]) {
        let reply = embed.generate('generic', ':tools: Cache information', '')
                        .addFields(
                            { name: 'Cache', value: cacheName, inline: true },
                            { name: 'Entries', value: Object.keys(cache[cacheName]).length, inline: true },
                            { name: 'Snowflake', value: snowflake, inline: true },
                            { name: 'Cache contents', value: JSON.stringify(cache[cacheName][snowflake], '', 4)}
                        );
        return reply;
    }
}

async function refreshCache() {
    await cache.populate();
    return embed.generate('success', 'Cache refresh', 'Successfully refreshed the cache');
}

async function execute(message, args) {
    let reply = '';
    if(typeof args === 'undefined' || !args.length) {
        reply = embed.generate('incomplete', 'Debug', "No operation specified");
        message.channel.send(reply);
        return; 
    }
    console.log(args[0]);

    switch(args[0]) {
        case "cache":
            if(args[1]) {
                reply = debugCache(message.guild.id, args[1]);
            } else {
                reply = embed.generate('incomplete', 'Debug cache', "Please specify which cache to show");
            }
        break;

        case "refreshcache":
            reply = await refreshCache();
        break;

        default:
            reply = embed.generate('incomplete', 'Debug', `I don't recognise the debug operation **${args[0]}** :thinking:`);
        break;
    }
    try {
        message.channel.send(reply);
    } catch(err) {
        console.error(err);
    }
}

module.exports = {
	name: 'debug',
	description: embed.generate('generic', `:information_source: debug`, 'Bot debugging information for use by the developer')
                    .addFields(
                        { name: 'Command', value: '.debug' },
                        { name: 'Arguments', value: '**[op]** *The operation to run, see below for a list*' },
                        { name: 'Supported operations', value: '**lasterror** *information about the last encounted error on this server*'}
                    ),
    flags: {
        developerOnly: true
    },
	execute: execute
};