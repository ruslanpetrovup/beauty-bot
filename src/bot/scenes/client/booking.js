const { Scenes } = require('telegraf');
const moment = require('moment');
const { Op } = require('sequelize');
const { Master, Client, Service, Schedule, Appointment } = require('../../../db/models');

const booking = new Scenes.WizardScene(
  'booking',
  // Шаг 1: Выбор мастера
  async (ctx) => {
    console.log("шаг 1", ctx.callbackQuery.data)
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'back_to_menu') {
      await ctx.reply('Добро пожаловать обратно! Выберите действие:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Записаться", callback_data: "book_appointment" }],
            [{ text: "Мои записи", callback_data: "my_appointments" }],
            [{ text: "Настройки профиля", callback_data: "profile" }],
          ]
        }
      });
      return ctx.scene.leave();
    }

    try {
      const masters = await Master.findAll({
        where: { isActive: true }
      });

      const keyboard = [
        ...masters.map(master => ([{
          text: master.name,
          callback_data: `select_master_${master.id}`
        }])),
        [{ text: 'Вернуться в меню', callback_data: 'back_to_menu' }]
      ];

      await ctx.reply('Выберите мастера:', {
        reply_markup: { inline_keyboard: keyboard }
      });

      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при получении списка мастеров:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  // Шаг 2: Выбор услуги
  async (ctx) => {
    try {
      if (!ctx.callbackQuery) return;
      const action = ctx.callbackQuery.data;
      console.log("шаг 2", action)
      
      if (action === 'back_to_menu') {
        await ctx.reply('Добро пожаловать обратно! Выберите действие:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Записаться", callback_data: "book_appointment" }],
              [{ text: "Мои записи", callback_data: "my_appointments" }],
              [{ text: "Настройки профиля", callback_data: "profile" }],
            ]
          }
        });
        return ctx.scene.leave();
      }

      if (action.startsWith('select_master_') || action.startsWith('back_to_services_')) {
        const masterId = action.startsWith('back_to_services_') ? action.split('_')[3] : action.split('_')[2];
        ctx.wizard.state.masterId = masterId;

        const services = await Service.findAll({
          where: { 
            masterId: masterId,
            isActive: true 
          }
        });

        const keyboard = [
          ...services.map(service => ([{
            text: `${service.name} - ${service.price} грн (${service.duration} мин)`,
            callback_data: `select_service_${service.id}`
          }])),
          [{ text: 'Назад', callback_data: `back_to_masters` }]
        ];

        await ctx.answerCbQuery(); // Добавляем ответ на callback query
        await ctx.reply('Выберите услугу:', {
          reply_markup: { inline_keyboard: keyboard }
        });

        return ctx.wizard.next();
      }
    } catch (error) {
      console.error('Ошибка при получении списка услуг:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  // Шаг 3: Выбор даты
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;

    console.log("шаг 3", action)

    if (action.startsWith('back_to_masters')) {
      await ctx.answerCbQuery(); // Добавляем ответ на callback query
      ctx.wizard.selectStep(0);
      return ctx.wizard.steps[0](ctx);
    }

    if (action.startsWith('back_to_services_')) {
      await ctx.answerCbQuery(); // Добавляем ответ на callback query
      ctx.wizard.selectStep(1);
      return ctx.wizard.steps[1](ctx);
    }

    if (action.startsWith('select_service_')) {
      const serviceId =  action.split('_')[2];
      ctx.wizard.state.serviceId = serviceId;

      try {
        const schedule = await Schedule.findAll({
          where: {
            masterId: ctx.wizard.state.masterId,
            date: {
              [Op.gte]: moment().startOf('day').toDate()
            }
          },
          order: [['date', 'ASC']],
          limit: 14
        });

        const keyboard = [
          ...schedule.map(slot => ([{
            text: moment(slot.date).format('DD.MM.YYYY'),
            callback_data: `select_date_${moment(slot.date).format('YYYY-MM-DD')}`
          }])),
          [{ text: 'Назад', callback_data: `back_to_services_${ctx.wizard.state.masterId}` }]
        ];
        await ctx.answerCbQuery();
        await ctx.reply('Выберите дату:', {
          reply_markup: { inline_keyboard: keyboard }
        });

        return ctx.wizard.next();
      } catch (error) {
        console.error('Ошибка при получении расписания:', error);
        await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
        return ctx.scene.leave();
      }
    }

    if (action.startsWith('select_date_')) {
      const date = action.split('_')[2];
      ctx.wizard.state.date = date;
      
      try {
        const [schedule, service] = await Promise.all([
          Schedule.findOne({
            where: {
              masterId: ctx.wizard.state.masterId,
              date: date
            }
          }),
          Service.findByPk(parseInt(ctx.wizard.state.serviceId))
        ]);

        if (!schedule || !service) {
          await ctx.reply('Не удалось найти расписание или услугу.');
          return ctx.wizard.back();
        }

        const appointments = await Appointment.findAll({
          where: {
            masterId: ctx.wizard.state.masterId,
            date: date,
            status: ['pending', 'confirmed']
          }
        });

        const slots = generateTimeSlots(
          schedule.timeStart,
          schedule.timeEnd,
          service.duration,
          appointments
        );

        if (slots.length === 0) {
          await ctx.reply('На выбранную дату нет свободных окон.');
          return ctx.wizard.back();
        }

        const keyboard = [
          ...slots.map(slot => ([{
            text: slot,
            callback_data: `select_time_${slot}`
          }])),
          [{ text: 'Назад', callback_data: 'back_to_dates' }]
        ];

        await ctx.reply('Выберите время:', {
          reply_markup: { inline_keyboard: keyboard }
        });

        return ctx.wizard.next();
      } catch (error) {
        console.error('Ошибка при получении свободного времени:', error);
        await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
        return ctx.scene.leave();
      }
    }
  },
  // Шаг 4: Выбор времени
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;

    console.log("шаг 4", action)

    if (action.startsWith('back_to_services_')) {
      await ctx.answerCbQuery(); // Добавляем ответ на callback query
      ctx.wizard.selectStep(1);
      return ctx.wizard.steps[1](ctx);
    }

    if (action === 'back_to_dates') {
      ctx.wizard.selectStep(2);
      return ctx.wizard.steps[2](ctx);
    }

    // Проверяем выбор времени
    if (action.startsWith('select_time_')) {
      const time = action.split('_')[2];
      ctx.wizard.state.time = time;

      try {
        const [master, service] = await Promise.all([
          Master.findByPk(ctx.wizard.state.masterId),
          Service.findByPk(ctx.wizard.state.serviceId)
        ]);

        const message = `
Подтвердите запись:

Мастер: ${master.name}
Услуга: ${service.name}
Дата: ${moment(ctx.wizard.state.date).format('DD.MM.YYYY')}
Время: ${time}
Длительность: ${service.duration} минут
Стоимость: ${service.price} грн

Хотите добавить комментарий к записи?`;

        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Добавить комментарий', callback_data: 'add_comment' }],
              [{ text: 'Подтвердить без комментария', callback_data: 'confirm_no_comment' }],
              [{ text: 'Отменить', callback_data: 'cancel_booking' }]
            ]
          }
        });

        return ctx.wizard.next();
      } catch (error) {
        console.error('Ошибка при подготовке подтверждения:', error);
        await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
        return ctx.scene.leave();
      }
    }
  },
  // Шаг 5: Подтверждение записи
  async (ctx) => {
    if (!ctx.callbackQuery) return;

    const action = ctx.callbackQuery.data;
    
    if (action === 'back_to_menu' || action === 'cancel_booking') {
      return ctx.scene.leave();
    }

    if (action === 'back_to_time') {
      await ctx.wizard.selectStep(3);
      return ctx.wizard.steps[3](ctx);
    }

    const time = ctx.callbackQuery.data.split('_')[2];
    ctx.wizard.state.time = time;

    try {
      const [master, service] = await Promise.all([
        Master.findByPk(ctx.wizard.state.masterId),
        Service.findByPk(ctx.wizard.state.serviceId)
      ]);

      const message = `
Подтвердите запись:

Мастер: ${master.name}
Услуга: ${service.name}
Дата: ${moment(ctx.wizard.state.date).format('DD.MM.YYYY')}
Время: ${time}
Длительность: ${service.duration} минут
Стоимость: ${service.price} грн

Хотите добавить комментарий к записи?`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Добавить комментарий', callback_data: 'add_comment' }],
            [{ text: 'Подтвердить без комментария', callback_data: 'confirm_no_comment' }],
            [{ text: 'Отменить', callback_data: 'cancel_booking' }]
          ]
        }
      });

      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при подготовке подтверждения:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  // Шаг 6: Обработка комментария и финальное подтверждение
  async (ctx) => {
    if (ctx.callbackQuery) {
      const action = ctx.callbackQuery.data;
      
      if (action === 'back_to_menu' || action === 'cancel_booking') {
        await ctx.reply('Бронирование отменено');
        return ctx.scene.leave();
      }

      if (action === 'confirm_no_comment') {
        return await finalizeBooking(ctx);
      }

      if (action === 'add_comment') {
        await ctx.reply('Введите ваш комментарий к записи:');
        ctx.wizard.state.waitingForComment = true;
        return;
      }
    }

    if (ctx.wizard.state.waitingForComment && ctx.message) {
      ctx.wizard.state.comment = ctx.message.text;
      return await finalizeBooking(ctx);
    }
  }
);

// Вспомогательные функции
function generateTimeSlots(startTime, endTime, duration, appointments) {
  const slots = [];
  let currentTime = moment(startTime, 'HH:mm');
  const end = moment(endTime, 'HH:mm');

  while (currentTime.isBefore(end)) {
    const timeStr = currentTime.format('HH:mm');
    const isAvailable = !appointments.some(app => {
      const appStart = moment(app.timeStart, 'HH:mm');
      const appEnd = moment(app.timeEnd, 'HH:mm');
      return currentTime.isBetween(appStart, appEnd, null, '[)');
    });

    if (isAvailable) {
      slots.push(timeStr);
    }

    currentTime.add(duration, 'minutes');
  }

  return slots;
}

async function finalizeBooking(ctx) {
  try {
    const client = await Client.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    const service = await Service.findByPk(ctx.wizard.state.serviceId);
    const timeEnd = moment(ctx.wizard.state.time, 'HH:mm')
      .add(service.duration, 'minutes')
      .format('HH:mm');

    const appointment = await Appointment.create({
      masterId: ctx.wizard.state.masterId,
      clientId: client.id,
      serviceId: ctx.wizard.state.serviceId,
      date: ctx.wizard.state.date,
      timeStart: ctx.wizard.state.time,
      timeEnd: timeEnd,
      comment: ctx.wizard.state.comment || null,
      status: 'pending'
    });

    // Отправляем уведомление мастеру
    const master = await Master.findByPk(ctx.wizard.state.masterId);
    await ctx.telegram.sendMessage(
      master.telegramId,
      `Новая запись!\n
Клиент: ${client.name}
Дата: ${moment(appointment.date).format('DD.MM.YYYY')}
Время: ${appointment.timeStart}
Услуга: ${service.name}
${appointment.comment ? `Комментарий: ${appointment.comment}` : ''}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Подтвердить', callback_data: `confirm_appointment_${appointment.id}` },
              { text: 'Отклонить', callback_data: `reject_appointment_${appointment.id}` }
            ]
          ]
        }
      }
    );

    await ctx.reply('Запись успешно создана! Ожидайте подтверждения от мастера.');
    return ctx.scene.leave();
  } catch (error) {
    console.error('Ошибка при создании записи:', error);
    await ctx.reply('Произошла ошибка при создании записи. Попробуйте еще раз.');
    return ctx.scene.leave();
  }
}

// Обновляем обработчик действия back_to_menu
booking.action('back_to_menu', async (ctx) => {
  await ctx.reply('Добро пожаловать обратно! Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Записаться", callback_data: "book_appointment" }],
        [{ text: "Мои записи", callback_data: "my_appointments" }],
        [{ text: "Настройки профиля", callback_data: "profile" }],
      ]
    }
  });
  return ctx.scene.leave();
});

// Добавьте middleware для обработки ошибок
booking.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Ошибка в сцене booking:', error);
    await ctx.reply('Произошла ошибка. Добро пожаловать обратно! Выберите действие:');
    return ctx.scene.leave();
  }
});

module.exports = booking;