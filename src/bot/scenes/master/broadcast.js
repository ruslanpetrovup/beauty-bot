const { Scenes } = require('telegraf');
const { Master, Client, Appointment } = require('../../../db/models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

const broadcast = new Scenes.WizardScene(
  'broadcast',
  async (ctx) => {
    try {
      const master = await Master.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      if (!master) {
        await ctx.reply('Доступно только для мастеров');
        return ctx.scene.leave();
      }

      await ctx.reply('Выберите действие:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Всем клиентам', callback_data: 'broadcast_all' }],
            [{ text: 'Вернуться в меню', callback_data: 'back_to_menu' }]
          ]
        }
      });
      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при инициализации рассылки:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;

    const action = ctx.callbackQuery.data;
    
    if (action === 'back_to_menu') {
      await showMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (action === 'broadcast_all') {
      ctx.wizard.state.broadcastType = action;
      await ctx.reply('Введите текст сообщения для рассылки:');
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    if (!ctx.message?.text) return;

    try {
      const master = await Master.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      const clientIds = await Appointment.findAll({
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('clientId')), 'clientId']],
        where: {
          masterId: master.id
        },
        raw: true
      });

      const clients = await Client.findAll({
        where: {
          id: {
            [Op.in]: clientIds.map(c => c.clientId)
          }
        }
      });

      let sentCount = 0;
      let errorCount = 0;

      for (const client of clients) {
        try {
          await ctx.telegram.sendMessage(
            client.telegramId,
            `Сообщение от мастера ${master.name}:\n\n${ctx.message.text}`
          );
          sentCount++;
        } catch (error) {
          console.error(`Ошибка отправки сообщения клиенту ${client.id}:`, error);
          errorCount++;
        }
      }

      await ctx.reply(
        `Рассылка завершена!\n` +
        `Успешно отправлено: ${sentCount}\n` +
        `Ошибок: ${errorCount}\n` +
        `Всего клиентов: ${clients.length}`
      );

      await showMainMenu(ctx);
      return ctx.scene.leave();
    } catch (error) {
      console.error('Ошибка при выполнении рассылки:', error);
      await ctx.reply('Произошла ошибка при выполнении рассылки.');
      await showMainMenu(ctx);
      return ctx.scene.leave();
    }
  }
);

async function showMainMenu(ctx) {
  await ctx.reply('Главное меню:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Управление услугами', callback_data: 'setup_services' }],
        [{ text: 'Управление расписанием', callback_data: 'setup_schedule' }],
        [{ text: 'Мои записи', callback_data: 'view_appointments' }],
        [{ text: 'Настройки профиля', callback_data: 'profile_settings' }],
        [{ text: 'Создать рассылку', callback_data: 'create_broadcast' }]
      ]
    }
  });
}

module.exports = broadcast; 