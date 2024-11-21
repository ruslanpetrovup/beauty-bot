const { Scenes, Markup } = require('telegraf');
const paymentService = require('../../../services/paymentService');
const reviewService = require('../../../services/reviewService');

const sessionCompletionScene = new Scenes.WizardScene(
    'sessionCompletion',
    // Шаг 1: Подтверждение завершения сеанса
    async (ctx) => {
        await ctx.reply(
            'Подтвердите, что сеанс завершен:',
            Markup.inlineKeyboard([
                [{ text: 'Подтверждаю', callback_data: 'session_completed' }]
            ])
        );
        return ctx.wizard.next();
    },
    // Шаг 2: Выбор способа оплаты
    async (ctx) => {
        if (!ctx.callbackQuery?.data === 'session_completed') return;

        await ctx.reply(
            'Желаете рассчитаться картой?',
            Markup.inlineKeyboard([
                [{ text: 'Да', callback_data: 'pay_card' }],
                [{ text: 'Нет', callback_data: 'pay_cash' }]
            ])
        );
        return ctx.wizard.next();
    },
    // Шаг 3: Обработка оплаты
    async (ctx) => {
        if (!ctx.callbackQuery) return;

        const paymentMethod = ctx.callbackQuery.data === 'pay_card' ? 'card' : 'cash';
        
        if (paymentMethod === 'card') {
            const paymentDetails = await paymentService.getPaymentDetails(ctx.scene.state.masterId);
            
            // Отправляем каждый IBAN отдельно
            if (paymentDetails?.iban) {
                for (const iban of paymentDetails.iban.split(',')) {
                    await ctx.reply(`IBAN для оплаты:\n${iban.trim()}`);
                }
            }
        }

        await paymentService.confirmPayment(ctx.scene.state.appointmentId, paymentMethod);
        
        // Переходим к оценке
        await ctx.reply(
            'Оцените, как прошел ваш сеанс от 1 до 5:',
            Markup.inlineKeyboard([
                [1, 2, 3, 4, 5].map(rating => ({
                    text: '⭐'.repeat(rating),
                    callback_data: `rate_${rating}`
                }))
            ])
        );

        return ctx.wizard.next();
    },
    // Шаг 4: Сбор отзыва
    async (ctx) => {
        if (!ctx.callbackQuery?.data.startsWith('rate_')) return;

        const rating = parseInt(ctx.callbackQuery.data.split('_')[1]);
        ctx.scene.state.rating = rating;

        await ctx.reply(
            'Желаете оставить комментарий к отзыву?',
            Markup.inlineKeyboard([
                [{ text: 'Да', callback_data: 'add_review_comment' }],
                [{ text: 'Нет', callback_data: 'skip_review_comment' }]
            ])
        );

        return ctx.wizard.next();
    },
    // Шаг 5: Обработка комментария к отзыву
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'skip_review_comment') {
            await finishReview(ctx);
            return ctx.scene.leave();
        } else if (ctx.callbackQuery?.data === 'add_review_comment') {
            await ctx.reply('Пожалуйста, напишите ваш отзыв:');
            return ctx.wizard.next();
        }
    },
    // Шаг 6: Сохранение отзыва
    async (ctx) => {
        if (!ctx.message?.text) return;

        ctx.scene.state.reviewComment = ctx.message.text;
        await finishReview(ctx);
        return ctx.scene.leave();
    }
);

async function finishReview(ctx) {
    try {
        await reviewService.createReview(
            ctx.scene.state.appointmentId,
            ctx.scene.state.rating,
            ctx.scene.state.reviewComment
        );

        await ctx.reply('Спасибо за ваш отзыв! Будем рады видеть вас снова! 🙏');
    } catch (error) {
        console.error('Error saving review:', error);
        await ctx.reply('Произошла ошибка при сохранении отзыва.');
    }
}

module.exports = { sessionCompletionScene };