const { Telegraf, session, Markup } = require('telegraf');
const config = require('../config/config');
const stage = require('./scenes');
const { registerClientHandlers } = require('./handlers/clientHandlers');
const { registerMasterHandlers } = require('./handlers/masterHandlers');
const { registerAppointmentHandlers } = require('./handlers/appointmentHandlers');
const { registerPaymentHandlers } = require('./handlers/paymentHandlers');
const { registerBusinessManagementHandlers } = require('./handlers/businessManagementHandlers');
const { registerClientManagementHandlers } = require('./handlers/masterClientManagementHandlers');
const userService = require('../services/userService');
const { getMainMenuKeyboard } = require('./keyboards');
const { registerCommonHandlers } = require('./handlers/commonHandlers');

const bot = new Telegraf(config.BOT_TOKEN);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Базовая команда /start
bot.command('start', async (ctx) => {
    try {
        const user = await userService.getUserByTelegramId(ctx.from.id);
        if (user) {
            const currentRole = await userService.getUserRole(ctx.from.id);
            ctx.session = ctx.session || {};
            ctx.session.currentRole = currentRole;
            await ctx.reply('С возвращением!', getMainMenuKeyboard(currentRole));
        } else {
            await ctx.reply(
                'Добро пожаловать! Пожалуйста, выберите тип регистрации:',
                Markup.inlineKeyboard([
                    [{ text: '👤 Зарегистрироваться как клиент', callback_data: 'register_client' }],
                    [{ text: '💼 Зарегистрироваться как мастер', callback_data: 'register_master' }]
                ])
            );
        }
    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

// Обработчики регистрации
bot.action('register_client', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await ctx.scene.enter('clientRegistration');
    } catch (error) {
        console.error('Error entering client registration scene:', error);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

bot.action('register_master', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await ctx.scene.enter('masterRegistration');
    } catch (error) {
        console.error('Error entering master registration scene:', error);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
});

// Обработчик кнопки смены роли
bot.hears('🔄 Сменить роль', async (ctx) => {
    try {
        await ctx.scene.enter('switchRole');
    } catch (error) {
        console.error('Error switching role:', error);
        await ctx.reply('Произошла ошибка при смене роли. Попробуйте позже.');
    }
});

// Регистрируем все обработчики
registerClientHandlers(bot);
registerMasterHandlers(bot);
registerCommonHandlers(bot);
registerAppointmentHandlers(bot);
registerPaymentHandlers(bot);
registerBusinessManagementHandlers(bot);
registerClientManagementHandlers(bot);

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
});

module.exports = { bot }; 