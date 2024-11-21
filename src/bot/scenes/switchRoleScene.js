const { Scenes, Markup } = require("telegraf");
const userService = require("../../services/userService");
const { getMainMenuKeyboard } = require("../keyboards");

const switchRoleScene = new Scenes.BaseScene('switchRole');

switchRoleScene.enter(async (ctx) => {
    try {
        const user = await userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            await ctx.reply('Пожалуйста, сначала зарегистрируйтесь.');
            return ctx.scene.leave();
        }

        const roles = await userService.getUserRoles(ctx.from.id);
        if (!roles || roles.length < 2) {
            await ctx.reply('У вас нет доступных ролей для переключения.');
            return ctx.scene.leave();
        }

        await ctx.reply(
            'Выберите роль:',
            Markup.keyboard([
                ['👤 Режим клиента', '💼 Режим мастера'],
                ['❌ Отмена']
            ]).resize()
        );
    } catch (error) {
        console.error('Error in switchRoleScene enter:', error);
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
        return ctx.scene.leave();
    }
});

switchRoleScene.hears(['👤 Режим клиента', '💼 Режим мастера'], async (ctx) => {
    try {
        const choice = ctx.message.text;
        const role = choice === '👤 Режим клиента' ? 'client' : 'master';

        await userService.updateUserRole(ctx.from.id, role);
        ctx.session.currentRole = role;

        await ctx.reply(
            `Вы переключились в ${role === 'client' ? 'режим клиента' : 'режим мастера'}!`,
            Markup.keyboard(getMainMenuKeyboard(role)).resize()
        );
        return ctx.scene.leave();
    } catch (error) {
        console.error('Error in role selection:', error);
        await ctx.reply('Произошла ошибка при смене роли.');
        return ctx.scene.leave();
    }
});

switchRoleScene.hears('❌ Отмена', async (ctx) => {
    await ctx.reply('Операция отменена.');
    return ctx.scene.leave();
});

// Обработка любых других сообщений
switchRoleScene.on('message', async (ctx) => {
    await ctx.reply('Пожалуйста, используйте кнопки для выбора роли.');
});

module.exports = switchRoleScene;
