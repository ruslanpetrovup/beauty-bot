require('dotenv').config();

module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    database: {
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        database: process.env.PGDATABASE
    },
    PORT: process.env.PORT || 3000,
    NOTIFICATION_DELAY: 24 * 60 * 60 * 1000,
    SESSION_DURATION: 15 * 60 * 1000
};