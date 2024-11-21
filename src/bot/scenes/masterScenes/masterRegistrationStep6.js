const userService = require('../../../services/userService');

module.exports = async (ctx) => {
    try {
        ctx.wizard.state.paymentDetails = { iban: ctx.message.text };
        
        const user = await userService.createUser(
            ctx.from.id,
            'master',
            ctx.wizard.state.name,
            ctx.wizard.state.phone
        );

        await userService.createMaster(
            user.id,
            ctx.wizard.state.salonName,
            ctx.wizard.state.address,
            ctx.wizard.state.paymentDetails
        );

        await ctx.reply('Регистрация успешно завершена! Теперь вы можете:');
        await ctx.reply('1. Создать прайс-лист\n2. Настроить расписание\n3. Получить ссылку для записи');
    } catch (error) {
        console.error('Master registration error:', error);
        await ctx.reply('Произошла ошибка при регистрации. Попробуйте позже.');
    }
    return ctx.scene.leave();
}; 