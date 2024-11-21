const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Добавляем методы для совместимости
logger.logError = (error, meta = {}) => {
    logger.error(error.message, { ...meta, stack: error.stack });
};

logger.logInfo = (message, meta = {}) => {
    logger.info(message, meta);
};

logger.logWarning = (message, meta = {}) => {
    logger.warn(message, meta);
};

module.exports = logger;