require('dotenv').config();
const { bot } = require('./src/bot/bot');
const db = require('./src/database/db');

async function start() {
    try {
        // Проверяем подключение к БД
        await db.checkConnection();
        console.log('Database connected:', await db.query('SELECT NOW()'));

        // Запускаем бота
        await bot.launch();
        console.log('Bot started');

        // Включаем graceful shutdown
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
}

start();