const { Markup } = require('telegraf');
const blockService = require('../../services/blockService');

const registerClientManagementHandlers = (bot) => {
    // Просмотр списка клиентов
    bot.command('clients', async (ctx) => {
        const masterId = ctx.session.masterId;
        const clients = await getClientsList(masterId);
        
        for (const client of clients) {
            const isBlocked = await blockService.isClientBlocked(masterId, client.id);
            
            await ctx.reply(
                `👤 Клиент: ${client.name}\n📱 Телефон: ${client.phone}`,
                Markup.inlineKeyboard([
                    [
                        {
                            text: isBlocked ? '✅ Разблокировать' : '❌ Заблокировать',
                            callback_data: isBlocked ? 
                                `unblock_client_${client.id}` : 
                                `block_client_${client.id}`
                        }
                    ],
                    [
                        {
                            text: '📊 Статистика',
                            callback_data: `client_stats_${client.id}`
                        }
                    ]
                ])
            );
        }
    });

    // Блокировка клиента
    bot.action(/^block_client_(\d+)$/, async (ctx) => {
        const clientId = ctx.match[1];
        await ctx.reply('Укажите причину блокировки:');
        ctx.session.blockingClientId = clientId;
        // Ожидаем следующее сообщение с причиной
    });

    // Обработка причины блокировки
    bot.on('text', async (ctx) => {
        if (ctx.session.blockingClientId) {
            const clientId = ctx.session.blockingClientId;
            const reason = ctx.message.text;
            
            await blockService.blockClient(ctx.session.masterId, clientId, reason);
            delete ctx.session.blockingClientId;
            
            await ctx.reply('Клиент заблокирован');
        }
    });

    // Разблокировка клиента
    bot.action(/^unblock_client_(\d+)$/, async (ctx) => {
        const clientId = ctx.match[1];
        await blockService.unblockClient(ctx.session.masterId, clientId);
        await ctx.reply('Клиент разблокирован');
    });

    // Статистика по клиенту
    bot.action(/^client_stats_(\d+)$/, async (ctx) => {
        const clientId = ctx.match[1];
        const stats = await getClientStats(ctx.session.masterId, clientId);
        
        await ctx.reply(
            `📊 Статистика клиента:\n\n` +
            `Всего записей: ${stats.totalAppointments}\n` +
            `Отмененных записей: ${stats.cancelledAppointments}\n` +
            `Средняя оценка: ${stats.averageRating.toFixed(1)}⭐\n` +
            `Последний визит: ${stats.lastVisit || 'Нет'}`
        );
    });
};

async function getClientsList(masterId) {
    const query = `
        SELECT DISTINCT 
            u.id, u.name, u.phone
        FROM appointments a
        JOIN users u ON a.client_id = u.id
        WHERE a.master_id = $1
        ORDER BY u.name
    `;
    const result = await db.query(query, [masterId]);
    return result.rows;
}

async function getClientStats(masterId, clientId) {
    // Реализация получения статистики
    // ...
}

module.exports = { registerClientManagementHandlers }; 