const { Scenes, Markup } = require('telegraf');
const appointmentService = require('../../../services/appointmentService');
const { getMainMenuKeyboard } = require('../../keyboards');

// Сцена просмотра записей
const viewAppointmentsScene = new Scenes.WizardScene(
    'viewAppointments',
    async (ctx) => {
        try {
            const appointments = await appointmentService.getMasterAppointments(ctx.from.id);
            
            if (appointments.length === 0) {
                await ctx.reply(
                    'У вас пока нет записей.',
                    getMainMenuKeyboard('master')
                );
                return ctx.scene.leave();
            }

            for (const apt of appointments) {
                await ctx.reply(
                    `Клиент: ${apt.clientName}\n` +
                    `Услуга: ${apt.serviceName}\n` +
                    `Дата: ${apt.date}\n` +
                    `Время: ${apt.time}\n` +
                    `Статус: ${apt.status}`
                );
            }
            
            await ctx.reply(
                'Список всех записей',
                getMainMenuKeyboard('master')
            );
        } catch (error) {
            console.error('Error viewing appointments:', error);
            await ctx.reply('Произошла ошибка при получении записей.');
        }
        return ctx.scene.leave();
    }
);

module.exports = {
    viewAppointmentsScene
}; 