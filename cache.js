const _ = require('lodash');

const cache = (function(){
    
    const cacheData = {}

    return {
        set: function(cacheName, data) {
            if(!cacheData.hasOwnProperty(cacheName)) {
                cacheData[cacheName] = data;
                return cacheData;
            }
            cacheData[cacheName] = _.cloneDeep(cacheData[cacheName], data);
            return cacheData[cacheName];
        },
        get: function(cacheName) {
            return cacheData[cacheName];
        },
        cacheData: cacheData
    }
})();

module.exports = cache;