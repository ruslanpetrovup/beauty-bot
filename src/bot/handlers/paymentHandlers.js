const { Markup } = require('telegraf');
const paymentService = require('../../services/paymentService');

const registerPaymentHandlers = (bot) => {
    // Обработка запроса на оплату
    bot.action(/^pay_appointment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        try {
            const appointment = await paymentService.getAppointmentDetails(appointmentId);
            
            await ctx.reply(
                `Оплата услуги "${appointment.service_name}"\n` +
                `Сумма к оплате: ${appointment.price} грн\n\n` +
                'Выберите способ оплаты:',
                Markup.inlineKeyboard([
                    [{ text: '💳 Оплатить картой', callback_data: `card_payment_${appointmentId}` }],
                    [{ text: '💵 Оплата наличными', callback_data: `cash_payment_${appointmentId}` }]
                ])
            );
        } catch (error) {
            console.error('Error processing payment request:', error);
            await ctx.reply('Произошла ошибка при обработке платежа.');
        }
    });

    // Оплата картой
    bot.action(/^card_payment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        try {
            const appointment = await paymentService.getAppointmentDetails(appointmentId);
            const paymentLink = await paymentService.createPaymentLink(
                appointmentId,
                appointment.price
            );

            await ctx.reply(
                'Для оплаты перейдите по ссылке:',
                Markup.inlineKeyboard([
                    [{ text: '💳 Перейти к оплате', url: paymentLink }]
                ])
            );
        } catch (error) {
            console.error('Error creating payment link:', error);
            await ctx.reply('Произошла ошибка при создании ссылки на оплату.');
        }
    });

    // Оплата наличными
    bot.action(/^cash_payment_(\d+)$/, async (ctx) => {
        const appointmentId = ctx.match[1];
        try {
            await paymentService.confirmPayment(appointmentId, {
                status: 'pending',
                payment_method: 'cash'
            });

            await ctx.reply(
                'Вы выбрали оплату наличными. Оплата будет произведена на месте.'
            );
        } catch (error) {
            console.error('Error processing cash payment:', error);
            await ctx.reply('Произошла ошибка при обработке платежа.');
        }
    });
};

module.exports = { registerPaymentHandlers }; 