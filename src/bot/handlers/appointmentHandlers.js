const { Markup } = require('telegraf');
const appointmentService = require('../../services/appointmentService');
const notificationService = require('../../services/notificationService');

const registerAppointmentHandlers = (bot) => {
    // Подтверждение записи мастером
    bot.action(/^confirm_appointment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        try {
            const appointment = await appointmentService.confirmAppointment(appointmentId);
            await notificationService.sendAppointmentConfirmation(appointment);
            await ctx.answerCbQuery('Запись подтверждена');
        } catch (error) {
            console.error('Error confirming appointment:', error);
            await ctx.answerCbQuery('Ошибка при подтверждении записи');
        }
    });

    // Отмена записи клиентом
    bot.action(/^cancel_appointment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        try {
            const appointment = await appointmentService.cancelAppointment(appointmentId);
            await notificationService.sendAppointmentCancellation(appointment);
            await ctx.answerCbQuery('Запись отменена');
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            await ctx.answerCbQuery('Ошибка при отмене записи');
        }
    });

    // Перенос записи
    bot.action(/^reschedule_appointment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        ctx.session.reschedulingAppointment = appointmentId;
        await ctx.scene.enter('selectDateTime');
    });
};

module.exports = { registerAppointmentHandlers }; 