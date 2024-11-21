const logger = require('./loggingService');

class CacheService {
    async set(key, value, ttl = 3600) {
        try {
            // Временно сохраняем в памяти
            if (!this.cache) this.cache = new Map();
            this.cache.set(key, JSON.stringify(value));
        } catch (error) {
            logger.logError(error, { context: 'cache_set', key });
        }
    }

    async get(key) {
        try {
            if (!this.cache) return null;
            const value = this.cache.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.logError(error, { context: 'cache_get', key });
            return null;
        }
    }
}

module.exports = new CacheService();