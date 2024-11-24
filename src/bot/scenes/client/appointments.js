const { Scenes } = require('telegraf');
const { Master, Client, Appointment, Service } = require('../../../db/models');
const moment = require('moment');

const appointmentManagement = new Scenes.WizardScene(
  'appointmentManagement',
  async (ctx) => {
    try {
      const isMaster = ctx.scene.state.isMaster;
      
      if (isMaster) {
        const master = await Master.findOne({
          where: { telegramId: ctx.from.id.toString() }
        });

        const appointments = await Appointment.findAll({
          where: { 
            masterId: master.id,
            status: ['pending', 'confirmed']
          },
          include: [
            { model: Client },
            { model: Service }
          ],
          order: [['date', 'ASC'], ['timeStart', 'ASC']]
        });

        if (appointments.length === 0) {
          await ctx.reply('У вас пока нет активных записей.');
        } else {
          for (const app of appointments) {
            const client = await Client.findByPk(app.clientId);
            const service = await Service.findByPk(app.serviceId);
            const message = `
Запись #${app.id}
Клиент: ${client.name}
Услуга: ${service.name}
Дата: ${moment(app.date).format('DD.MM.YYYY')}
Время: ${app.timeStart}
Статус: ${app.status === 'pending' ? 'Ожидает подтверждения' : 'Подтверждено'}
            `;

            await ctx.reply(message, {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: 'Подтвердить', callback_data: `confirm_app_${app.id}` },
                    { text: 'Отменить', callback_data: `cancel_app_${app.id}` }
                  ]
                ]
              }
            });
          }
        }
      } else {
        const client = await Client.findOne({
          where: { telegramId: ctx.from.id.toString() }
        });

        const appointments = await Appointment.findAll({
          where: { 
            clientId: client.id,
            status: ['pending', 'confirmed']
          },
          include: [
            { model: Master },
            { model: Service }
          ],
          order: [['date', 'ASC'], ['timeStart', 'ASC']]
        });

        if (appointments.length === 0) {
          await ctx.reply('У вас пока нет активных записей.');
        } else {
          for (const app of appointments) {
            const master = await Master.findOne({
              where: { id: app.masterId },
            });
            console.log(master);
            const service = await Service.findByPk(app.serviceId);
            const message = `
Запись #${app.id}
Мастер: ${master.name}
Услуга: ${service.name}
Дата: ${moment(app.date).format('DD.MM.YYYY')}
Время: ${app.timeStart}
Статус: ${app.status === 'pending' ? 'Ожидает подтверждения' : 'Подтверждено'}
            `;

            await ctx.reply(message, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Отменить запись', callback_data: `cancel_app_${app.id}` }]
                ]
              }
            });
          }
        }
      }

      await ctx.reply('Выберите действие:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Вернуться в меню', callback_data: 'back_to_menu' }]
          ]
        }
      });

      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при просмотре записей:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;

    if (action === 'back_to_menu') {
      return ctx.scene.leave();
    }

    try {
      if (action.startsWith('confirm_app_') || action.startsWith('cancel_app_')) {
        const appId = action.split('_')[2];
        console.log('ID записи:', appId);
        
        const appointment = await Appointment.findByPk(appId);
        console.log('Найдена запись:', appointment);

        if (!appointment) {
          await ctx.reply('Запись не найдена');
          return ctx.scene.leave();
        }

        console.log('ID клиента:', appointment.clientId);
        console.log('ID мастера:', appointment.masterId);
        console.log('ID услуги:', appointment.serviceId);

        // Получаем данные по отдельности и логируем их
        const client = await Client.findByPk(appointment.clientId);
        console.log('Данные клиента:', client);
        
        const master = await Master.findByPk(appointment.masterId);
        console.log('Данные мастера:', master);
        
        const service = await Service.findByPk(appointment.serviceId);
        console.log('Данные услуги:', service);

        // Проверяем наличие всех необходимых данных
        if (!client) {
          console.log('Клиент не найден');
          await ctx.reply('Ошибка: клиент не найден');
          return ctx.scene.leave();
        }

        if (!master) {
          console.log('Мастер не найден');
          await ctx.reply('Ошибка: мастер не найден');
          return ctx.scene.leave();
        }

        if (!service) {
          console.log('Услуга не найдена');
          await ctx.reply('Ошибка: услуга не найдена');
          return ctx.scene.leave();
        }

        console.log(client.telegramId);
        if (!client.telegramId) {
          console.log('У клиента отсутствует telegramId');
          await ctx.reply('Ошибка: у клиента отсутствует идентификатор Telegram');
          return ctx.scene.leave();
        }

        if (action.startsWith('confirm_app_')) {
          await appointment.update({ status: 'confirmed' });
          
          await ctx.telegram.sendMessage(
            client.telegramId,
            `Ваша запись подтверждена!\n
Мастер: ${master.name}
Услуга: ${service.name}
Дата: ${moment(appointment.date).format('DD.MM.YYYY')}
Время: ${appointment.timeStart}`
          );

          await ctx.reply('Запись подтверждена');
        } else {
          await appointment.update({ status: 'cancelled' });
          
          await ctx.telegram.sendMessage(
            client.telegramId,
            `Ваша запись отменена.\n
Мастер: ${master.name}
Услуга: ${service.name}
Дата: ${moment(appointment.date).format('DD.MM.YYYY')}
Время: ${appointment.timeStart}

Пожалуйста, выберите другое время для записи.`
          );

          await ctx.reply('Запись отменена');
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке записи:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
    }

    return ctx.scene.leave();
  }
);

module.exports = appointmentManagement;