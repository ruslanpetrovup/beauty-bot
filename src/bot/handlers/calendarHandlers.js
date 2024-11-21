const { Markup } = require('telegraf');
const calendarService = require('../../services/calendarService');
const broadcastService = require('../../services/broadcastService');

const registerCalendarHandlers = (bot) => {
    // Подключение Google Calendar
    bot.command('connect_calendar', async (ctx) => {
        try {
            const authUrl = await calendarService.generateAuthUrl(ctx.session.masterId);
            
            await ctx.reply(
                'Для подключения Google Calendar перейдите по ссылке:',
                Markup.inlineKeyboard([
                    [{ text: 'Подключить календарь', url: authUrl }]
                ])
            );
        } catch (error) {
            console.error('Error generating auth URL:', error);
            await ctx.reply('Произошла ошибка при подключении календаря.');
        }
    });

    // Экспорт расписания
    bot.command('export_calendar', async (ctx) => {
        await ctx.reply(
            'Выберите период для экспорта:',
            Markup.inlineKeyboard([
                [
                    { text: 'Неделя', callback_data: 'export_week' },
                    { text: 'Месяц', callback_data: 'export_month' }
                ]
            ])
        );
    });

    // Создание рассылки
    bot.command('create_broadcast', async (ctx) => {
        await ctx.reply(
            'Выберите группу получателей:',
            Markup.inlineKeyboard([
                [{ text: 'Все клиенты', callback_data: 'broadcast_all' }],
                [{ text: 'Недавние клиенты', callback_data: 'broadcast_recent' }],
                [{ text: 'Предстоящие записи', callback_data: 'broadcast_upcoming' }]
            ])
        );
    });

    // Обработка выбора группы для рассылки
    bot.action(/^broadcast_(.+)$/, async (ctx) => {
        const targetGroup = ctx.match[1];
        ctx.session.broadcastTarget = targetGroup;
        
        await ctx.reply('Введите текст сообщения для рассылки:');
        ctx.session.awaitingBroadcastMessage = true;
    });

    // Обработка текста рассылки
    bot.on('text', async (ctx) => {
        if (ctx.session.awaitingBroadcastMessage) {
            try {
                const broadcast = await broadcastService.createBroadcast(
                    ctx.session.masterId,
                    ctx.message.text,
                    { targetGroup: ctx.session.broadcastTarget }
                );

                await ctx.reply('Рассылка создана и запущена!');
                
                // Очищаем состояние
                delete ctx.session.awaitingBroadcastMessage;
                delete ctx.session.broadcastTarget;
            } catch (error) {
                console.error('Error creating broadcast:', error);
                await ctx.reply('Произошла ошибка при создании рассылки.');
            }
        }
    });

    // Статистика рассылок
    bot.command('broadcast_stats', async (ctx) => {
        try {
            const stats = await broadcastService.getBroadcastStats(ctx.session.masterId);
            
            await ctx.reply(
                `📊 Статистика рассылок:\n\n` +
                `Всего рассылок: ${stats.total_broadcasts}\n` +
                `Успешно доставлено: ${stats.total_delivered}\n` +
                `Ошибок доставки: ${stats.total_failed}\n` +
                `Средний % успеха: ${(stats.average_success_rate * 100).toFixed(1)}%`
            );
        } catch (error) {
            console.error('Error getting broadcast stats:', error);
            await ctx.reply('Произошла ошибка при получении статистики.');
        }
    });
};

module.exports = { registerCalendarHandlers }; 