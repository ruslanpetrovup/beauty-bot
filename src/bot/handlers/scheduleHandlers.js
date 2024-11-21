const { Markup } = require('telegraf');
const scheduleManagementService = require('../../services/scheduleManagementService');
const moment = require('moment');

const registerScheduleHandlers = (bot) => {
    // Управление расписанием
    bot.command('manage_schedule', async (ctx) => {
        await ctx.reply(
            'Управление расписанием:',
            Markup.keyboard([
                ['Настроить рабочие дни'],
                ['Отметить выходной'],
                ['Сгенерировать слоты'],
                ['Назад']
            ]).resize()
        );
    });

    // Отметить выходной
    bot.hears('Отметить выходной', async (ctx) => {
        const dates = [];
        for (let i = 0; i < 14; i++) {
            const date = moment().add(i, 'days');
            dates.push({
                text: date.format('DD.MM (dd)'),
                callback_data: `day_off_${date.format('YYYY-MM-DD')}`
            });
        }

        const keyboard = dates.reduce((acc, date, idx) => {
            if (idx % 2 === 0) acc.push([date]);
            else acc[acc.length - 1].push(date);
            return acc;
        }, []);

        await ctx.reply(
            'Выберите дату для выходного:',
            Markup.inlineKeyboard(keyboard)
        );
    });

    // Обработка выбора выходного дня
    bot.action(/^day_off_(.+)$/, async (ctx) => {
        const date = ctx.match[1];
        try {
            await scheduleManagementService.markDayOff(
                ctx.session.masterId,
                date
            );
            await ctx.reply(`Выходной день ${moment(date).format('DD.MM.YYYY')} успешно отмечен!`);
        } catch (error) {
            console.error('Error marking day off:', error);
            await ctx.reply('Произошла ошибка при установке выходного дня.');
        }
    });

    // Генерация слотов
    bot.hears('Сгенерировать слоты', async (ctx) => {
        await ctx.reply(
            'Выберите период для генерации слотов:',
            Markup.inlineKeyboard([
                [
                    { text: '1 неделя', callback_data: 'generate_1week' },
                    { text: '2 недели', callback_data: 'generate_2weeks' }
                ],
                [
                    { text: '1 месяц', callback_data: 'generate_1month' },
                    { text: '2 месяца', callback_data: 'generate_2months' }
                ]
            ])
        );
    });

    // Обработка выбора периода генерации
    bot.action(/^generate_(.+)$/, async (ctx) => {
        const period = ctx.match[1];
        const dateFrom = moment().startOf('day');
        const dateTo = moment().add(
            period === '1week' ? 1 :
            period === '2weeks' ? 2 :
            period === '1month' ? 1 :
            2,
            period.includes('week') ? 'weeks' : 'months'
        ).endOf('day');

        try {
            await scheduleManagementService.generateTimeSlots(
                ctx.session.masterId,
                dateFrom,
                dateTo
            );
            await ctx.reply('Слоты успешно сгенерированы!');
        } catch (error) {
            console.error('Error generating slots:', error);
            await ctx.reply('Произошла ошибка при генерации слотов.');
        }
    });
};

module.exports = { registerScheduleHandlers }; 