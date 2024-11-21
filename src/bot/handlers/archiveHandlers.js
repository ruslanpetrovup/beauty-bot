const { Markup } = require('telegraf');
const archiveService = require('../../services/archiveService');
const moment = require('moment');

const registerArchiveHandlers = (bot) => {
    // Просмотр архива для клиента
    bot.command('my_history', async (ctx) => {
        try {
            const result = await archiveService.getClientArchive(ctx.from.id);
            const appointments = result.rows;

            if (appointments.length === 0) {
                await ctx.reply('У вас пока нет завершенных записей.');
                return;
            }

            for (const apt of appointments) {
                const message = `
                    📅 Дата: ${moment(apt.start_time).format('DD.MM.YYYY HH:mm')}
                    👤 Мастер: ${apt.master_name}
                    🏠 Салон: ${apt.salon_name}
                    💇 Услуга: ${apt.service_name}
                    💰 Стоимость: ${apt.price} грн
                    ${apt.rating ? `⭐ Оценка: ${apt.rating}` : ''}
                    ${apt.review_comment ? `💬 Отзыв: ${apt.review_comment}` : ''}
                `;
                
                await ctx.reply(message.trim());
            }
        } catch (error) {
            console.error('Error getting client archive:', error);
            await ctx.reply('Произошла ошибка при получении архива записей.');
        }
    });

    // Просмотр архива и статистики для мастера
    bot.command('statistics', async (ctx) => {
        await ctx.reply(
            'Выберите период для просмотра статистики:',
            Markup.inlineKeyboard([
                [
                    { text: '30 дней', callback_data: 'stats_30days' },
                    { text: '90 дней', callback_data: 'stats_90days' }
                ],
                [{ text: '1 год', callback_data: 'stats_1year' }]
            ])
        );
    });

    // Обработка выбора периода статистики
    bot.action(/^stats_(.+)$/, async (ctx) => {
        const period = ctx.match[1];
        try {
            const result = await archiveService.getMasterStatistics(ctx.session.masterId, period);
            const stats = result.rows[0];

            const message = `
                📊 Статистика за ${
                    period === '30days' ? '30 дней' : 
                    period === '90days' ? '90 дней' : 
                    '1 год'
                }:

                📅 Всего записей: ${stats.total_appointments}
                ✅ Завершено: ${stats.completed_appointments} (${stats.completion_rate}%)
                ❌ Отменено: ${stats.cancelled_appointments} (${stats.cancellation_rate}%)
                ⭐ Средняя оценка: ${stats.average_rating ? stats.average_rating.toFixed(1) : 'Нет оценок'}
                💰 Общая выручка: ${stats.total_revenue} грн

                Хотите просмотреть детальный архив записей за этот период?
            `;

            await ctx.reply(
                message,
                Markup.inlineKeyboard([
                    [{ text: 'Показать архив записей', callback_data: `archive_${period}` }]
                ])
            );
        } catch (error) {
            console.error('Error getting master statistics:', error);
            await ctx.reply('Произошла ошибка при получении статистики.');
        }
    });

    // Просмотр детального архива мастера
    bot.action(/^archive_(.+)$/, async (ctx) => {
        const period = ctx.match[1];
        try {
            const dateFrom = moment().subtract(
                period === '30days' ? 30 : 
                period === '90days' ? 90 : 
                365, 'days'
            ).toDate();

            const result = await archiveService.getMasterArchive(
                ctx.session.masterId,
                { dateFrom }
            );
            
            const appointments = result.rows;
            
            if (appointments.length === 0) {
                await ctx.reply('Нет завершенных записей за выбранный период.');
                return;
            }

            // Группируем записи по дням для удобного отображения
            const groupedAppointments = appointments.reduce((acc, apt) => {
                const date = moment(apt.start_time).format('DD.MM.YYYY');
                if (!acc[date]) acc[date] = [];
                acc[date].push(apt);
                return acc;
            }, {});

            for (const [date, dayAppointments] of Object.entries(groupedAppointments)) {
                let message = `📅 ${date}\n\n`;
                
                for (const apt of dayAppointments) {
                    message += `
                        🕒 ${moment(apt.start_time).format('HH:mm')}
                        👤 ${apt.client_name}
                        📱 ${apt.client_phone}
                        💇 ${apt.service_name}
                        💰 ${apt.price} грн
                        ${apt.rating ? `⭐ ${apt.rating}` : ''}
                        ${apt.review_comment ? `💬 ${apt.review_comment}` : ''}
                        ─────────────
                    `;
                }
                
                await ctx.reply(message.trim());
            }
        } catch (error) {
            console.error('Error getting master archive:', error);
            await ctx.reply('Произошла ошибка при получении архива записей.');
        }
    });
};

module.exports = { registerArchiveHandlers }; 