const { Scenes, Markup } = require('telegraf');
const moment = require('moment');
const appointmentService = require('../../../services/appointmentService');
const serviceService = require('../../../services/serviceService');

const selectServiceScene = new Scenes.WizardScene(
    'selectService',
    // Шаг 1: Выбор услуги
    async (ctx) => {
        const services = await serviceService.getMasterServices(ctx.scene.state.masterId);
        
        const serviceButtons = services.map(service => ({
            text: `${service.name} - ${service.price}грн`,
            callback_data: `service_${service.id}`
        }));

        await ctx.reply(
            'Выберите услугу:',
            Markup.inlineKeyboard(serviceButtons.map(btn => [btn]))
        );

        return ctx.wizard.next();
    },
    // Шаг 2: Обработка выбора услуги
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const serviceId = ctx.callbackQuery.data.split('_')[1];
        ctx.scene.state.serviceId = serviceId;
        
        await ctx.scene.enter('selectDateTime', ctx.scene.state);
    }
);

const selectDateTimeScene = new Scenes.WizardScene(
    'selectDateTime',
    // Шаг 1: Выбор месяца
    async (ctx) => {
        const months = [];
        for (let i = 0; i < 3; i++) {
            const month = moment().add(i, 'months');
            months.push({
                text: month.format('MMMM YYYY'),
                callback_data: `month_${month.format('YYYY-MM')}`
            });
        }

        await ctx.reply(
            'Выберите месяц:',
            Markup.inlineKeyboard(months.map(btn => [btn]))
        );

        return ctx.wizard.next();
    },
    // Шаг 2: Выбор дня
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const [, yearMonth] = ctx.callbackQuery.data.split('_');
        const month = moment(yearMonth);
        const days = [];
        
        const daysInMonth = month.daysInMonth();
        for (let i = 1; i <= daysInMonth; i++) {
            const date = moment(yearMonth).date(i);
            if (date.isSameOrAfter(moment(), 'day')) {
                days.push({
                    text: date.format('DD.MM'),
                    callback_data: `date_${date.format('YYYY-MM-DD')}`
                });
            }
        }

        const keyboard = days.reduce((acc, btn, idx) => {
            if (idx % 4 === 0) acc.push([]);
            acc[acc.length - 1].push(btn);
            return acc;
        }, []);

        await ctx.reply(
            'Выберите день:',
            Markup.inlineKeyboard(keyboard)
        );

        return ctx.wizard.next();
    },
    // Шаг 3: Выбор времени
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const [, date] = ctx.callbackQuery.data.split('_');
        const timeSlots = await appointmentService.getAvailableTimeSlots(
            ctx.scene.state.masterId,
            date
        );

        const timeButtons = timeSlots.map(slot => ({
            text: moment(slot.start_time).format('HH:mm'),
            callback_data: `time_${slot.id}`
        }));

        await ctx.reply(
            'Выберите время:',
            Markup.inlineKeyboard(timeButtons.map(btn => [btn]))
        );

        return ctx.wizard.next();
    },
    // Шаг 4: Подтверждение записи
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const [, timeSlotId] = ctx.callbackQuery.data.split('_');
        
        await ctx.reply(
            'Хотите добавить комментарий к записи?',
            Markup.inlineKeyboard([
                [{ text: 'Да', callback_data: 'add_comment' }],
                [{ text: 'Нет', callback_data: 'no_comment' }]
            ])
        );

        ctx.scene.state.timeSlotId = timeSlotId;
        return ctx.wizard.next();
    },
    // Шаг 5: Добавление комментария или завершение записи
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'add_comment') {
            await ctx.reply('Введите ваш комментарий:');
            return ctx.wizard.next();
        } else if (ctx.callbackQuery?.data === 'no_comment') {
            return await finalizeAppointment(ctx);
        }
    },
    // Шаг 6: Сохранение записи
    async (ctx) => {
        const comment = ctx.message?.text;
        return await finalizeAppointment(ctx, comment);
    }
);

async function finalizeAppointment(ctx, comment = null) {
    try {
        const appointment = await appointmentService.createAppointment(
            ctx.from.id,
            ctx.scene.state.masterId,
            ctx.scene.state.serviceId,
            ctx.scene.state.timeSlotId,
            comment
        );

        await ctx.reply(
            'Запись успешно создана! Ожидайте подтверждения от мастера.'
        );

        // Отправляем уведомление мастеру
        // ... код отправки уведомления ...

        return ctx.scene.leave();
    } catch (error) {
        console.error('Error creating appointment:', error);
        await ctx.reply('Произошла ошибка при создании записи. Попробуйте позже.');
        return ctx.scene.leave();
    }
}

module.exports = { selectServiceScene, selectDateTimeScene };
