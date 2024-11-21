const { Scenes, Markup } = require('telegraf');
const userService = require('../../services/userService');
const { getMainMenuKeyboard } = require('../keyboards');

const masterRegistrationScene = new Scenes.WizardScene(
    'masterRegistration',
    async (ctx) => {
        ctx.session.registration = { userType: 'master' };
        await ctx.reply('Введите ваше имя:');
        return ctx.wizard.next();
    },
    // Имя
    async (ctx) => {
        ctx.session.registration.name = ctx.message.text;
        await ctx.reply('Введите ваш номер телефона:');
        return ctx.wizard.next();
    },
    // Телефон
    async (ctx) => {
        ctx.session.registration.phone = ctx.message.text;
        await ctx.reply('Введите название вашего салона:');
        return ctx.wizard.next();
    },
    // Салон
    async (ctx) => {
        try {
            const { name, phone, userType } = ctx.session.registration;
            const salonName = ctx.message.text;

            await userService.createUser({
                telegramId: ctx.from.id,
                name,
                phone,
                userType,
                salonName
            });

            await ctx.reply(
                'Регистрация успешно завершена! Теперь вы можете использовать бот в режиме мастера.',
                getMainMenuKeyboard('master')
            );
            return ctx.scene.leave();
        } catch (error) {
            console.error('Error during master registration:', error);
            await ctx.reply('Произошла ошибка при регистрации. Попробуйте позже.');
            return ctx.scene.leave();
        }
    }
);

// Обработка отмены регистрации
masterRegistrationScene.hears('❌ Отменить регистрацию', async (ctx) => {
    await ctx.reply(
        'Регистрация отменена.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

module.exports = masterRegistrationScene;