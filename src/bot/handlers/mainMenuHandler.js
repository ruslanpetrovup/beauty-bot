const { Markup } = require('telegraf');
const { getMainMenuKeyboard } = require('../keyboards');

const registerMainMenuHandlers = (bot) => {
    // Обработчик команды /start
    bot.command('start', async (ctx) => {
        try {
            await ctx.reply(
                'Добро пожаловать! Выберите действие:',
                Markup.inlineKeyboard([
                    [{ text: '👤 Зарегистрироваться как клиент', callback_data: 'register_client' }],
                    [{ text: '💼 Зарегистрироваться как мастер', callback_data: 'register_master' }]
                ])
            );
        } catch (error) {
            console.error('Error in start command:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });
};

module.exports = { registerMainMenuHandlers };