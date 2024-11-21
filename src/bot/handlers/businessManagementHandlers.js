const { Markup } = require('telegraf');
const businessManagementService = require('../../services/businessManagementService');
const reportingService = require('../../services/reportingService');

const registerBusinessManagementHandlers = (bot) => {
    // Главное меню управления
    bot.command('manage_business', async (ctx) => {
        await ctx.reply(
            'Управление бизнесом:',
            Markup.keyboard([
                ['📊 Отчеты', '👥 Сотрудники'],
                ['📦 Склад', '💰 Финансы'],
                ['Назад']
            ]).resize()
        );
    });

    // Обработка выбора отчета
    bot.hears('📊 Отчеты', async (ctx) => {
        await ctx.reply(
            'Выберите тип отчета:',
            Markup.inlineKeyboard([
                [
                    { text: 'За день', callback_data: 'report_day' },
                    { text: 'За неделю', callback_data: 'report_week' }
                ],
                [
                    { text: 'За месяц', callback_data: 'report_month' },
                    { text: 'За год', callback_data: 'report_year' }
                ],
                [{ text: 'Детальный отчет', callback_data: 'report_detailed' }]
            ])
        );
    });

    // Обработка запроса отчета
    bot.action(/^report_(.+)$/, async (ctx) => {
        const period = ctx.match[1];
        try {
            if (period === 'detailed') {
                const fileName = await reportingService.generateDetailedReport(
                    ctx.session.masterId,
                    {
                        dateFrom: moment().subtract(1, 'month').startOf('month'),
                        dateTo: moment().endOf('month')
                    }
                );
                
                await ctx.replyWithDocument({
                    source: `./reports/${fileName}`,
                    filename: 'Детальный отчет.xlsx'
                });
            } else {
                const report = await businessManagementService.getFinancialReport(
                    ctx.session.masterId,
                    period
                );
                
                await sendFinancialReport(ctx, report.rows, period);
            }
        } catch (error) {
            console.error('Error generating report:', error);
            await ctx.reply('Произошла ошибка при формировании отчета.');
        }
    });

    // Управление сотрудниками
    bot.hears('👥 Сотрудники', async (ctx) => {
        await ctx.reply(
            'Управление сотрудниками:',
            Markup.inlineKeyboard([
                [{ text: 'Добавить сотрудника', callback_data: 'add_employee' }],
                [{ text: 'Список сотрудников', callback_data: 'list_employees' }],
                [{ text: 'Статистика работы', callback_data: 'employee_stats' }]
            ])
        );
    });
};

async function sendFinancialReport(ctx, data, period) {
    const periodText = {
        day: 'день',
        week: 'неделю',
        month: 'месяц',
        year: 'год'
    }[period];

    const message = `
        📊 Финансовый отчет за ${periodText}:

        💰 Общий доход: ${data.total_revenue} грн
        📉 Расходы: ${data.total_expenses} грн
        📈 Чистая прибыль: ${data.net_profit} грн
        
        👥 Количество клиентов: ${data.unique_clients}
        📝 Количество записей: ${data.total_appointments}
        💵 Средний чек: ${data.average_check} грн
    `;

    await ctx.reply(message);
}

module.exports = { registerBusinessManagementHandlers }; 