const { Scenes, Markup } = require('telegraf');
const userService = require('../../services/userService');
const { getMainMenuKeyboard } = require('../keyboards');

const clientRegistrationScene = new Scenes.WizardScene(
    'clientRegistration',
    async (ctx) => {
        ctx.session.registration = { userType: 'client' };
        await ctx.reply('Введите ваше имя:');
        return ctx.wizard.next();
    },
    // Шаг 1: Запрос имени
    async (ctx) => {
        await ctx.reply(
            'Введите ваше имя:',
            Markup.keyboard([['❌ Отменить регистрацию']]).resize()
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Запрос телефона
    async (ctx) => {
        if (ctx.message.text === '❌ Отменить регистрацию') {
            await ctx.reply(
                'Регистрация отменена.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        }

        ctx.scene.state.name = ctx.message.text;
        await ctx.reply(
            'Отправьте ваш номер телефона:',
            Markup.keyboard([
                [Markup.button.contactRequest('📱 Отправить номер телефона')],
                ['❌ Отменить регистрацию']
            ]).resize()
        );
        return ctx.wizard.next();
    },
    // Шаг 3: Сохранение данных
    async (ctx) => {
        if (ctx.message.text === '❌ Отменить регистрацию') {
            await ctx.reply(
                'Регистрация отменена.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        }

        try {
            const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
            
            await userService.createUser({
                telegramId: ctx.from.id,
                name: ctx.scene.state.name,
                phone: phone,
                userType: 'client'
            });

            await ctx.reply(
                'Регистрация успешно завершена! Теперь вы можете пользоваться всеми функциями бота.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        } catch (error) {
            console.error('Error during registration:', error);
            await ctx.reply(
                'Произошла ошибка при регистрации. Попробуйте позже.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        }
    }
);

// Обработка отмены регистрации
clientRegistrationScene.hears('❌ Отменить регистрацию', async (ctx) => {
    await ctx.reply(
        'Регистрация отменена.',
        getMainMenuKeyboard('client')
    );
    return ctx.scene.leave();
});

module.exports = clientRegistrationScene;