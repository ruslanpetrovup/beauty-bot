const { Scenes, Markup } = require('telegraf');
const serviceService = require('../../../services/serviceService');
const { getMainMenuKeyboard } = require('../../keyboards');

// В начале файла добавим общий обработчик для всех сцен
const handleReturnToMainMenu = async (ctx) => {
    try {
        await ctx.reply('Возвращаемся в главное меню', getMainMenuKeyboard('master'));
        return ctx.scene.leave();
    } catch (error) {
        console.error('Error returning to main menu:', error);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
};

const addServiceScene = new Scenes.WizardScene(
    'addService',
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        ctx.session = ctx.session || {};
        ctx.session.currentRole = 'master';
        await ctx.reply('Введите название услуги:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        ctx.scene.state.name = ctx.message.text;
        await ctx.reply('Введите стоимость услуги (в грн):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        if (isNaN(ctx.message.text)) {
            await ctx.reply('Пожалуйста, введите числовое значение.');
            return;
        }
        ctx.scene.state.price = parseFloat(ctx.message.text);
        await ctx.reply('Введите длительность услуги (в минутах):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        if (isNaN(ctx.message.text)) {
            await ctx.reply('Пожалуйста, введите числовое значение.');
            return;
        }
        try {
            const service = await serviceService.createService({
                masterId: ctx.from.id,
                name: ctx.scene.state.name,
                price: ctx.scene.state.price,
                duration: parseInt(ctx.message.text)
            });
            
            await ctx.reply(
                'Услуга успешно добавлена!',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error adding service:', error);
            await ctx.reply(
                'Произошла ошибка при добавлении услуги.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
        }
        return ctx.scene.leave();
    }
);

const editServicesScene = new Scenes.WizardScene(
    'editServices',
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        try {
            const services = await serviceService.getMasterServices(ctx.from.id);
            
            if (services.length === 0) {
                await ctx.reply(
                    'У вас пока нет услуг.',
                    Markup.keyboard([
                        ['➕ Добавить услугу'],
                        ['📝 Редактировать услуги'],
                        ['❌ Удалить услугу'],
                        ['↩️ Вернуться в главное меню']
                    ]).resize()
                );
                return ctx.scene.leave();
            }

            const keyboard = services.map(service => ([{
                text: `${service.name} - ${service.price} грн`,
                callback_data: `edit_service_${service.id}`
            }]));

            await ctx.reply(
                'Выберите услугу для редактирования:',
                Markup.inlineKeyboard(keyboard)
            );
            return ctx.wizard.next();
        } catch (error) {
            console.error('Error getting services:', error);
            await ctx.reply(
                'Произошла ошибка при получении списка услуг.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
            return ctx.scene.leave();
        }
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        if (!ctx.callbackQuery) return;

        const serviceId = ctx.callbackQuery.data.split('_')[2];
        ctx.scene.state.serviceId = serviceId;

        await ctx.reply(
            'Что вы хотите изменить?',
            Markup.keyboard([
                ['📝 Название'],
                ['💰 Цену'],
                ['⏱ Длительность'],
                ['❌ Отмена']
            ]).resize()
        );
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        if (ctx.message.text === '❌ Отмена') {
            await ctx.reply(
                'Редактирование отменено.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
            return ctx.scene.leave();
        }

        ctx.scene.state.editField = {
            '📝 Название': 'name',
            '💰 Цену': 'price',
            '⏱ Длительность': 'duration'
        }[ctx.message.text];

        await ctx.reply(`Введите новое значение для поля "${ctx.message.text}"`);
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        try {
            const updates = {};
            updates[ctx.scene.state.editField] = 
                ctx.scene.state.editField === 'price' || ctx.scene.state.editField === 'duration'
                    ? parseFloat(ctx.message.text)
                    : ctx.message.text;

            await serviceService.updateService(
                ctx.scene.state.serviceId,
                ctx.from.id,
                updates
            );

            await ctx.reply(
                'Услуга успешно обновлена!',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error updating service:', error);
            await ctx.reply(
                'Произошла ошибка при обновлении услуги.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
        }
        return ctx.scene.leave();
    }
);

const deleteServiceScene = new Scenes.WizardScene(
    'deleteService',
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        try {
            const services = await serviceService.getMasterServices(ctx.from.id);
            
            if (services.length === 0) {
                await ctx.reply(
                    'У вас пока нет услуг для удаления.',
                    Markup.keyboard([
                        ['➕ Добавить услугу'],
                        ['📝 Редактировать услуги'],
                        ['❌ Удалить услугу'],
                        ['↩️ Вернуться в главное меню']
                    ]).resize()
                );
                return ctx.scene.leave();
            }

            const keyboard = services.map(service => ([{
                text: `${service.name} - ${service.price} грн`,
                callback_data: `delete_service_${service.master_service_id}`
            }]));

            keyboard.push([{
                text: '❌ Отмена',
                callback_data: 'cancel_delete'
            }]);

            await ctx.reply(
                'Выберите услугу для удаления:',
                Markup.inlineKeyboard(keyboard)
            );

            return ctx.wizard.next();
        } catch (error) {
            console.error('Error getting services:', error);
            await ctx.reply(
                'Произошла ошибка при получении списка услуг.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
            return ctx.scene.leave();
        }
    },
    async (ctx) => {
        if (ctx.message?.text === '↩️ Вернуться в главное меню') {
            return handleReturnToMainMenu(ctx);
        }
        if (!ctx.callbackQuery) return;

        const action = ctx.callbackQuery.data;

        if (action === 'cancel_delete') {
            await ctx.reply(
                'Отмена удаления.',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['↩️ Вернуться в главное меню']
                ]).resize()
            );
            return ctx.scene.leave();
        }

        if (action.startsWith('delete_service_')) {
            const serviceId = action.split('_')[2];
            try {
                await serviceService.deactivateService(serviceId);
                await ctx.answerCbQuery('Услуга успешно удалена!');
                await ctx.reply(
                    'Услуга успешно удалена!',
                    Markup.keyboard([
                        ['➕ Добавить услугу'],
                        ['📝 Редактировать услуги'],
                        ['❌ Удалить услугу'],
                        ['↩️ Вернуться в главное меню']
                    ]).resize()
                );
            } catch (error) {
                console.error('Error deleting service:', error);
                await ctx.answerCbQuery('Ошибка при удалении услуги');
                await ctx.reply(
                    'Произошла ошибка при удалении услуги.',
                    Markup.keyboard([
                        ['➕ Добавить услугу'],
                        ['📝 Редактировать услуги'],
                        ['❌ Удалить услугу'],
                        ['↩️ Вернуться в главное меню']
                    ]).resize()
                );
            }
            return ctx.scene.leave();
        }
    }
);

// Добавляем обработчики отмены
addServiceScene.hears('❌ Отмена', async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentRole = 'master';
    await ctx.reply(
        'Действие отменено.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

deleteServiceScene.hears('❌ Отмена', async (ctx) => {
    await ctx.reply(
        'Удаление отменено.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

addServiceScene.hears('↩️ Вернуться в главное меню', async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentRole = 'master';
    await ctx.reply(
        'Возвращаемся в главное меню.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

editServicesScene.hears('↩️ Вернуться в главное меню', async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentRole = 'master';
    await ctx.reply(
        'Возвращаемся в главное меню.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

deleteServiceScene.hears('↩️ Вернуться в главное меню', async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.currentRole = 'master';
    await ctx.reply(
        'Возвращаемся в главное меню.',
        getMainMenuKeyboard('master')
    );
    return ctx.scene.leave();
});

module.exports = {
    addServiceScene,
    editServicesScene,
    deleteServiceScene
}; 