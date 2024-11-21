const { getMainMenuKeyboard } = require('../keyboards');

const registerCommonHandlers = (bot) => {
    bot.hears('⬅️ Назад в главное меню', async (ctx) => {
        try {
            ctx.session = ctx.session || {};
            const role = ctx.session.currentRole || 'client';
            await ctx.reply(
                'Главное меню:',
                getMainMenuKeyboard(role)
            );
        } catch (error) {
            console.error('Error returning to main menu:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });
};

module.exports = { registerCommonHandlers };