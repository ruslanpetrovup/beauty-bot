const { Markup } = require('telegraf');
const integrationService = require('../../services/integrationService');
const backupService = require('../../services/backupService');

const registerSystemHandlers = (bot) => {
    // Управление интеграциями
    bot.command('integrations', async (ctx) => {
        await ctx.reply(
            'Управление интеграциями:',
            Markup.inlineKeyboard([
                [{ text: 'Monobank', callback_data: 'connect_monobank' }],
                [{ text: 'Instagram', callback_data: 'connect_instagram' }],
                [{ text: 'Nova Poshta', callback_data: 'connect_novaposhta' }]
            ])
        );
    });

    // Подключение Monobank
    bot.action('connect_monobank', async (ctx) => {
        await ctx.reply(
            'Для подключения Monobank введите токен API:\n' +
            'Получить токен можно на странице https://api.monobank.ua/'
        );
        ctx.session.awaitingMonobankToken = true;
    });

    // Обработка токена Monobank
    bot.on('text', async (ctx) => {
        if (ctx.session.awaitingMonobankToken) {
            try {
                await integrationService.connectMonobank(
                    ctx.session.masterId,
                    ctx.message.text
                );
                await ctx.reply('Monobank успешно подключен!');
            } catch (error) {
                await ctx.reply(error.message);
            }
            delete ctx.session.awaitingMonobankToken;
        }
    });

    // Управление резервными копиями
    bot.command('backup', async (ctx) => {
        if (!ctx.session.isAdmin) {
            await ctx.reply('Доступ запрещен');
            return;
        }

        await ctx.reply(
            'Управление резервными копиями:',
            Markup.inlineKeyboard([
                [{ text: 'Создать бэкап', callback_data: 'create_backup' }],
                [{ text: 'Список бэкапов', callback_data: 'list_backups' }],
                [{ text: 'Восстановить', callback_data: 'restore_backup' }]
            ])
        );
    });

    // Создание бэкапа
    bot.action('create_backup', async (ctx) => {
        try {
            await ctx.reply('Создание резервной копии...');
            const filename = await backupService.createBackup();
            await ctx.reply(`Резервная копия ${filename} успешно создана!`);
        } catch (error) {
            await ctx.reply('Ошибка создания резервной копии');
        }
    });

    // Список бэкапов
    bot.action('list_backups', async (ctx) => {
        try {
            const backups = await backupService.getBackupsList();
            
            if (backups.rows.length === 0) {
                await ctx.reply('Резервные копии отсутствуют');
                return;
            }

            const message = backups.rows.map(backup => 
                `📁 ${backup.filename}\n` +
                `📅 ${moment(backup.created_at).format('DD.MM.YYYY HH:mm')}\n` +
                `✅ Статус: ${backup.status}\n`
            ).join('\n');

            await ctx.reply(message);
        } catch (error) {
            await ctx.reply('Ошибка получения списка резервных копий');
        }
    });
};

module.exports = { registerSystemHandlers }; 