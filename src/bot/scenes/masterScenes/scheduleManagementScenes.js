const { Scenes, Markup } = require('telegraf');
const scheduleManagementService = require('../../../services/scheduleManagementService');
const moment = require('moment');

const scheduleSetupScene = new Scenes.WizardScene(
    'scheduleSetup',
    // Шаг 1: Выбор дня недели
    async (ctx) => {
        const daysOfWeek = [
            'Понедельник', 'Вторник', 'Среда', 
            'Четверг', 'Пятница', 'Суббота', 'Воскресенье'
        ];

        await ctx.reply(
            'Выберите день недели:',
            Markup.keyboard(daysOfWeek.map(day => [day]))
                .oneTime()
                .resize()
        );

        return ctx.wizard.next();
    },
    // Шаг 2: Время начала работы
    async (ctx) => {
        ctx.wizard.state.dayOfWeek = daysOfWeek.indexOf(ctx.message.text);
        
        await ctx.reply(
            'Введите время начала работы (формат ЧЧ:ММ):',
            Markup.removeKeyboard()
        );

        return ctx.wizard.next();
    },
    // Шаг 3: Время окончания работы
    async (ctx) => {
        if (!isValidTimeFormat(ctx.message.text)) {
            await ctx.reply('Неверный формат времени. Попробуйте снова (например, 09:00):');
            return;
        }

        ctx.wizard.state.startTime = ctx.message.text;
        await ctx.reply('Введите время окончания работы (формат ЧЧ:ММ):');
        return ctx.wizard.next();
    },
    // Шаг 4: Перерыв
    async (ctx) => {
        if (!isValidTimeFormat(ctx.message.text)) {
            await ctx.reply('Неверный формат времени. Попробуйте снова (например, 18:00):');
            return;
        }

        ctx.wizard.state.endTime = ctx.message.text;
        
        await ctx.reply(
            'Хотите добавить перерыв?',
            Markup.inlineKeyboard([
                [
                    { text: 'Да', callback_data: 'add_break' },
                    { text: 'Нет', callback_data: 'no_break' }
                ]
            ])
        );

        return ctx.wizard.next();
    },
    // Шаг 5: Время перерыва (если нужен)
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'no_break') {
            ctx.wizard.state.breakStart = null;
            ctx.wizard.state.breakEnd = null;
            return await handleSlotDuration(ctx);
        }

        if (ctx.callbackQuery?.data === 'add_break') {
            await ctx.reply('Введите время начала перерыва (формат ЧЧ:ММ):');
            return ctx.wizard.next();
        }

        if (!isValidTimeFormat(ctx.message.text)) {
            await ctx.reply('Неверный формат времени. Попробуйте снова:');
            return;
        }

        ctx.wizard.state.breakStart = ctx.message.text;
        await ctx.reply('Введите время окончания перерыва (формат ЧЧ:ММ):');
        return ctx.wizard.next();
    },
    // Шаг 6: Длительность слота
    async (ctx) => {
        if (!isValidTimeFormat(ctx.message.text)) {
            await ctx.reply('Неверный формат времени. Попробуйте снова:');
            return;
        }

        ctx.wizard.state.breakEnd = ctx.message.text;
        return await handleSlotDuration(ctx);
    },
    // Шаг 7: Сохранение расписания
    async (ctx) => {
        if (!isValidNumber(ctx.message.text)) {
            await ctx.reply('Пожалуйста, введите число (например, 30):');
            return;
        }

        ctx.wizard.state.slotDuration = parseInt(ctx.message.text);

        try {
            await scheduleManagementService.createScheduleTemplate(
                ctx.session.masterId,
                ctx.wizard.state
            );

            await ctx.reply(
                'Расписание успешно сохранено! Хотите сгенерировать слоты на ближайший месяц?',
                Markup.inlineKeyboard([
                    [
                        { text: 'Да', callback_data: 'generate_slots' },
                        { text: 'Нет', callback_data: 'skip_generation' }
                    ]
                ])
            );
        } catch (error) {
            console.error('Error saving schedule:', error);
            await ctx.reply('Произошла ошибка при сохранении расписания.');
        }

        return ctx.wizard.next();
    },
    // Шаг 8: Генерация слотов
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'generate_slots') {
            try {
                const dateFrom = moment().startOf('day');
                const dateTo = moment().add(1, 'month').endOf('day');

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
        }

        await ctx.reply('Настройка расписания завершена!');
        return ctx.scene.leave();
    }
);

async function handleSlotDuration(ctx) {
    await ctx.reply(
        'Введите длительность одного слота в минутах (например, 30):'
    );
    return ctx.wizard.next();
}

function isValidTimeFormat(time) {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

function isValidNumber(str) {
    return !isNaN(str) && parseInt(str) > 0;
}

module.exports = { scheduleSetupScene }; 