const { Markup } = require('telegraf');
const loggingService = require('../../services/loggingService');
const moment = require('moment');

const registerLoggingHandlers = (bot) => {
    // Просмотр логов
    bot.command('logs', async (ctx) => {
        if (!ctx.session.isAdmin) {
            await ctx.reply('Доступ запрещен');
            return;
        }

        await ctx.reply(
            'Просмотр логов:',
            Markup.inlineKeyboard([
                [
                    { text: 'Последние логи', callback_data: 'logs_recent' },
                    { text: 'Ошибки', callback_data: 'logs_errors' }
                ],
                [
                    { text: 'Статистика', callback_data: 'logs_stats' },
                    { text: 'Поиск', callback_data: 'logs_search' }
                ]
            ])
        );
    });

    // Последние логи
    bot.action('logs_recent', async (ctx) => {
        try {
            const logs = await loggingService.getRecentLogs({ limit: 10 });
            
            if (logs.rows.length === 0) {
                await ctx.reply('Логи отсутствуют');
                return;
            }

            for (const log of logs.rows) {
                const message = `
                    📝 Тип: ${log.type}
                    🕒 Время: ${moment(log.created_at).format('DD.MM.YYYY HH:mm:ss')}
                    📄 Данные: ${JSON.stringify(log.data, null, 2)}
                `;

                await ctx.reply(message);
            }
        } catch (error) {
            await ctx.reply('Ошибка получения логов');
        }
    });

    // Поиск в логах
    bot.action('logs_search', async (ctx) => {
        await ctx.reply('Введите поисковый запрос:');
        ctx.session.awaitingLogSearch = true;
    });

    // Обработка поискового запроса
    bot.on('text', async (ctx) => {
        if (ctx.session.awaitingLogSearch) {
            try {
                const logs = await loggingService.searchLogs(ctx.message.text);
                
                if (logs.rows.length === 0) {
                    await ctx.reply('Логи не найдены');
                    return;
                }

                for (const log of logs.rows) {
                    const message = `
                        📝 Тип: ${log.type}
                        🕒 Время: ${moment(log.created_at).format('DD.MM.YYYY HH:mm:ss')}
                        📄 Данные: ${JSON.stringify(log.data, null, 2)}
                    `;

                    await ctx.reply(message);
                }
            } catch (error) {
                await ctx.reply('Ошибка поиска в логах');
            }
            
            delete ctx.session.awaitingLogSearch;
        }
    });
};

module.exports = { registerLoggingHandlers }; 