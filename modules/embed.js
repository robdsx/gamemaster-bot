const Discord = require('discord.js');

const colors = {
    RED: '#ff2a00',
    ORANGE: '#ffbf00',
    GREEN: '#00ff40'
}

const templates = {
    error: {
        color: colors.RED,
        icon: ':x:',
    },
    warning: {
        color: colors.ORANGE,
        icon: ':x:',        
    },
    incomplete: {
        color: colors.ORANGE,
        icon: ':question:',               
    },
    success: {
        color: colors.GREEN,
        icon: ':white_check_mark:'
    },
    disallowed: {
        color: colors.RED,
        icon: ':lock:'       
    },
    generic: {
        color: '#00d5ff'
    }
}

function generate(template = 'generic', title, description, options = {}) {
    if(!templates.hasOwnProperty(template)) {
        template = 'generic';
    }
    template = templates[template];
    const reply = new Discord.MessageEmbed()
                    .setDescription(description)
                    .setColor(template.color);
    if(template.icon) {
        title = template.icon + ' ' + title;
    }
    reply.setTitle(title);
    return reply;
}

module.exports = {
    generate: generate
}