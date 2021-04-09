const si = require('systeminformation');
const messageBuilder = require('../helpers/message-builder');
const package = require('../package.json');
const cache = require('../cache');

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function execute(message, args) {
    const reply = messageBuilder.embed('', {
        template: 'generic',
        title: ':wrench: Bot status'
    });
    const load = await si.currentLoad();
    const mem = await si.mem();
    const status = {
        load: () => {
            let flag = ':green_circle:';
            let currentLoad = load.currentLoad.toFixed(1);
            let avgLoad = load.avgLoad.toFixed(1);
            if(avgLoad > 70 || currentLoad > 85) {
                flag = ':yellow_circle:';
            }
            if(avgLoad > 90 || currentLoad > 95) {
                flag = ':red_circle:';
            }
            return `${flag} Current: ${currentLoad}%, Average: ${avgLoad}%`;
        },
        responseTime: () => {
            let flag = ':green_circle:';
            let responseTime = Date.now() - message.createdTimestamp;
            flag = ':green_circle:'; 
            if(responseTime > 2000) {
                flag = ':yellow_circle:';
            }
            if(responseTime > 4000) {
                flag = ':red_circle';
            }
            return `${flag} ${responseTime}ms`;
        },
        memory: () => {
            let flag = ':green_circle:';
            let memoryUsage = `${formatBytes(mem.active)} of ${formatBytes(mem.total)}`;
            let memoryPercentage = (mem.active / mem.total * 100);
            if(memoryPercentage > 75) {
                flag = ':yellow_circle:';
            }
            if(memoryPercentage > 90) {
                flag = ':red_circle:';
            }
            return `${flag} ${memoryUsage} (${memoryPercentage.toFixed(1)}%)`;
        },
        process: () => {
            return formatBytes(process.memoryUsage().rss);
        }
    }
    reply.addFields(
        { name: 'Bot uptime', value: new Date(Math.floor(process.uptime()) * 1000).toISOString().substr(11, 8), inline: true },
        { name: 'Bot response time', value: status.responseTime(), inline: true },
        { name: 'System load', value: status.load(), inline: true },
        { name: 'Process memory usage', value: status.process(), inline: true },
        { name: 'System memory usage', value: status.memory(), inline: true }
    );
    reply.setFooter(`Bot version ${package.version}`);
    message.channel.send(reply);
}

module.exports = {
	name: 'status',
	description: 'Get status information about the bot and the system',
    aliases: ['systemstatus', 'botstatus', 'stat', 'st'],
	execute: execute
};