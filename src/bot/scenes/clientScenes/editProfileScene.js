const { Scenes, Markup } = require('telegraf');
const userService = require('../../../services/userService');
const { getMainMenuKeyboard } = require('../../keyboards');

const editProfileScene = new Scenes.WizardScene(
    'editProfile',
    // Шаг 1: Выбор что редактировать
    async (ctx) => {
        await ctx.reply(
            'Что вы хотите изменить?',
            Markup.keyboard([
                ['👤 Изменить имя'],
                ['📱 Изменить телефон'],
                ['❌ Отмена']
            ]).resize()
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Обработка выбора
    async (ctx) => {
        const choice = ctx.message.text;

        switch (choice) {
            case '👤 Изменить имя':
                ctx.scene.state.editField = 'name';
                await ctx.reply(
                    'Введите новое имя:',
                    Markup.keyboard([['❌ Отмена']]).resize()
                );
                return ctx.wizard.next();

            case '📱 Изменить телефон':
                ctx.scene.state.editField = 'phone';
                await ctx.reply(
                    'Отправьте новый номер телефона:',
                    Markup.keyboard([
                        [Markup.button.contactRequest('📱 Отправить номер телефона')],
                        ['❌ Отмена']
                    ]).resize()
                );
                return ctx.wizard.next();

            case '❌ Отмена':
                await ctx.reply(
                    'Редактирование отменено.',
                    getMainMenuKeyboard('client')
                );
                return ctx.scene.leave();

            default:
                await ctx.reply('Пожалуйста, используйте кнопки для выбора.');
                return;
        }
    },
    // Шаг 3: Сохранение изменений
    async (ctx) => {
        if (ctx.message.text === '❌ Отмена') {
            await ctx.reply(
                'Редактирование отменено.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        }

        try {
            const field = ctx.scene.state.editField;
            let value = ctx.message.text;

            if (field === 'phone' && ctx.message.contact) {
                value = ctx.message.contact.phone_number;
            }

            await userService.updateUser(ctx.from.id, { [field]: value });

            await ctx.reply(
                'Профиль успешно обновлен!',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        } catch (error) {
            console.error('Error updating profile:', error);
            await ctx.reply(
                'Произошла ошибка при обновлении профиля. Попробуйте позже.',
                getMainMenuKeyboard('client')
            );
            return ctx.scene.leave();
        }
    }
);

// Обработка отмены на любом шаге
editProfileScene.hears('❌ Отмена', async (ctx) => {
    await ctx.reply(
        'Редактирование отменено.',
        getMainMenuKeyboard('client')
    );
    return ctx.scene.leave();
});

module.exports = editProfileScene; 