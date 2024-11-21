const { BOT_USERNAME } = require('../config/config');

class LinkService {
    generateMasterLink(masterId) {
        // Создаем deep link для Telegram
        return `https://t.me/${BOT_USERNAME}?start=m${masterId}`;
    }

    parseMasterLink(startPayload) {
        // Парсим параметр из deep link
        if (startPayload && startPayload.startsWith('m')) {
            return startPayload.substring(1);
        }
        return null;
    }
}

module.exports = new LinkService(); 