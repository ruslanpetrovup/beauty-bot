const { Markup } = require('telegraf');
const securityService = require('../../services/securityService');

const registerSecurityHandlers = (bot) => {
    // Управление безопасностью
    bot.command('security', async (ctx) => {
        if (!ctx.session.isAdmin) {
            await ctx.reply('Доступ запрещен');
            return;
        }

        await ctx.reply(
            'Управление безопасностью:',
            Markup.inlineKeyboard([
                [{ text: '🔐 Сменить пароль', callback_data: 'change_password' }],
                [{ text: '📱 Активные сессии', callback_data: 'active_sessions' }],
                [{ text: '🚫 Заблокированные IP', callback_data: 'blocked_ips' }],
                [{ text: '📊 Отчет по безопасности', callback_data: 'security_report' }]
            ])
        );
    });

    // Смена пароля
    bot.action('change_password', async (ctx) => {
        await ctx.reply('Введите текущий пароль:');
        ctx.session.awaitingOldPassword = true;
    });

    // Обработка ввода паролей
    bot.on('text', async (ctx) => {
        if (ctx.session.awaitingOldPassword) {
            ctx.session.oldPassword = ctx.message.text;
            await ctx.reply('Введите новый пароль:');
            ctx.session.awaitingOldPassword = false;
            ctx.session.awaitingNewPassword = true;
        } else if (ctx.session.awaitingNewPassword) {
            try {
                await securityService.updatePassword(
                    ctx.session.userId,
                    ctx.session.oldPassword,
                    ctx.message.text
                );
                await ctx.reply('Пароль успешно изменен!');
            } catch (error) {
                await ctx.reply(error.message);
            }
            
            delete ctx.session.oldPassword;
            delete ctx.session.awaitingNewPassword;
        }
    });

    // Активные сессии
    bot.action('active_sessions', async (ctx) => {
        try {
            const sessions = await securityService.getActiveSessions(ctx.session.userId);
            
            if (sessions.length === 0) {
                await ctx.reply('Активные сессии отсутствуют');
                return;
            }

            for (const session of sessions) {
                const message = `
                    📱 Устройство: ${session.device_info}
                    🌐 IP: ${session.ip_address}
                    🕒 Последняя активность: ${moment(session.last_activity).format('DD.MM.YYYY HH:mm')}
                `;

                await ctx.reply(
                    message,
                    Markup.inlineKeyboard([
                        [{ 
                            text: '❌ Завершить сессию', 
                            callback_data: `terminate_session_${session.id}` 
                        }]
                    ])
                );
            }
        } catch (error) {
            await ctx.reply('Ошибка получения списка сессий');
        }
    });
};

module.exports = { registerSecurityHandlers }; 