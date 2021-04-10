const Discord = require('discord.js');

const colors = {
    RED: '#ff2a00',
    ORANGE: '#ffbf00',
    GREEN: '#00ff40'
}

const templates = {
    error: { color: colors.RED, icon: ':x:' },
    warning: { color: colors.ORANGE, icon: ':x:' },
    incomplete: { color: colors.ORANGE, icon: ':question:' },
    success: { color: colors.GREEN, icon: ':white_check_mark:' },
    disallowed: { color: colors.RED, icon: ':lock:' },
    info: { color: '#00d5ff', icon: ':information_source:' },
    generic: { color: '#00d5ff' }
}

function embed(description, data = {}) {
    const template = data.template || 'generic';
    const embed = new Discord.MessageEmbed().setColor(templates[template].color);
    if(description && description.length > 0) embed.setDescription(description);
    if(data.title) embed.setTitle(`${templates[template].icon ? templates[template].icon + ' ' : ''}${data.title}`);
    if(data.footer) embed.setFooter(data.footer);
    if(data.URL) embed.setURL(data.URL);
    if(data.author) embed.setURL(data.author);
    if(data.image) embed.setImage(data.image);
    if(data.thumbnail) embed.setThumbnail(data.thumbnail);
    if(data.timestamp) embed.setTimestamp();
    if(data.fields) {
        data.fields.forEach(field => {
            embed.addField(field[0], field[1], field[2] || false );
        });
    }
    return embed;
}

function template(templateMessage, replacements = {}) {
    Object.keys(replacements).forEach(replacement => {
        templateMessage = templateMessage.replace(new RegExp('{{' + replacement + '}}', 'g'), replacements[replacement]);
    });
    return templateMessage;
}

function getUserFromMention(mention, client) {
    if(!mention) return;
    if(mention.startsWith('<@') && mention.endsWith('>')) {
        mention = mention.slice(2, -1);
        if (mention.startsWith('!')) {
            mention = mention.slice(1);
        }
        return client.users.cache.get(mention);
    }
}

module.exports = {
    embed: embed,
    getUserFromMention: getUserFromMention,
    template: template
}