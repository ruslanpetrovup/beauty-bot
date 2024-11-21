const { Markup } = require('telegraf');
const { getMainMenuKeyboard } = require('../keyboards');

const registerMasterHandlers = (bot) => {
    // Обработчик "Управление услугами"
    bot.hears('📊 Управление услугами', async (ctx) => {
        try {
            ctx.session = ctx.session || {};
            ctx.session.currentRole = 'master';
            await ctx.reply(
                'Выберите действие:',
                Markup.keyboard([
                    ['➕ Добавить услугу'],
                    ['📝 Редактировать услуги'],
                    ['❌ Удалить услугу'],
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error in service management:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик "Мои клиенты"
    bot.hears('📅 Мои клиенты', async (ctx) => {
        try {
            ctx.session.currentRole = 'master';
            await ctx.reply(
                'Выберите действие:',
                Markup.keyboard([
                    ['📅 Сегодняшние записи'],
                    ['📊 Все записи'],
                    ['🔍 Поиск клиента'],
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error in client management:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик "Настройки"
    bot.hears('⚙️ Настройки', async (ctx) => {
        try {
            ctx.session.currentRole = 'master';
            await ctx.reply(
                'Выберите настройку:',
                Markup.keyboard([
                    ['🕒 Настройка расписания'],
                    ['💰 Настройка оплаты'],
                    ['📍 Изменить адрес'],
                    ['✏️ Редактировать профиль'],
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error in settings:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик добавления услуги
    bot.hears('➕ Добавить услугу', async (ctx) => {
        try {
            await ctx.scene.enter('addService');
        } catch (error) {
            console.error('Error entering add service scene:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик редактирования услуг
    bot.hears('📝 Редактировать услуги', async (ctx) => {
        try {
            await ctx.scene.enter('editServices');
        } catch (error) {
            console.error('Error entering edit services scene:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик удаления услуги
    bot.hears('❌ Удалить услугу', async (ctx) => {
        try {
            await ctx.scene.enter('deleteService');
        } catch (error) {
            console.error('Error entering delete service scene:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик "Сегодняшние записи"
    bot.hears('📅 Сегодняшние записи', async (ctx) => {
        try {
            await ctx.scene.enter('viewAppointments', { filter: 'today' });
        } catch (error) {
            console.error('Error viewing today appointments:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });

    // Обработчик "Все записи"
    bot.hears('📊 Все записи', async (ctx) => {
        try {
            await ctx.scene.enter('viewAppointments', { filter: 'all' });
        } catch (error) {
            console.error('Error viewing all appointments:', error);
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
        }
    });
};

module.exports = { registerMasterHandlers }; 