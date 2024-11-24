const { Scenes } = require('telegraf');
const { Schedule, Master } = require('../../../db/models');
const moment = require('moment');
const { Op } = require('sequelize');

// Обновляем функцию показа меню расписания
async function showScheduleMenu(ctx) {
  await ctx.reply('Управление расписанием:', {
    reply_markup: {
      keyboard: [
        ['➕ Добавить время', '📋 Просмотреть расписание'],
        ['🔙 Вернуться в меню']
      ],
      resize_keyboard: true
    }
  });
}

// Обновляем функцию главного меню
async function showMainMenu(ctx) {
  await ctx.reply('Главное меню:', {
    reply_markup: {
      keyboard: [
        ['💼 Управление услугами', '📅 Управление расписанием'],
        ['📝 Мои записи', '⚙️ Настройки профиля'],
        ['📢 Создать рассылку']
      ],
      resize_keyboard: true
    }
  });
}

// Создаем сцену управления расписа��ием
const scheduleManagement = new Scenes.WizardScene(
  'scheduleManagement',
  // Шаг 1: Показываем меню
  async (ctx) => {
    await showScheduleMenu(ctx);
    return ctx.wizard.next();
  }
);

// Добавляем обработчик текстовых сообщений для всей сцены
scheduleManagement.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Обработка команд нижнего бара
  switch (text) {
    case '➕ Добавить время':
      await ctx.reply('Введите дату (формат ДД.ММ.ГГГГ):', {
        reply_markup: { remove_keyboard: true }
      });
      ctx.wizard.state.action = 'adding_date';
      return;

    case '📋 Просмотреть расписание':
      await showScheduleList(ctx);
      return;

    case '🔙 Вернуться в меню':
      await showMainMenu(ctx);
      return ctx.scene.leave();
  }

  // Обработка добавления расписания
  if (ctx.wizard.state.action === 'adding_date') {
    const date = moment(text, 'DD.MM.YYYY');
    if (!date.isValid()) {
      await ctx.reply('Пожалуйста, введите корректную дату в формате ДД.ММ.ГГГГ');
      return;
    }
    ctx.wizard.state.date = date.format('YYYY-MM-DD');
    ctx.wizard.state.action = 'adding_time_start';
    await ctx.reply('Введите время начала (формат ЧЧ:ММ):');
    return;
  }

  if (ctx.wizard.state.action === 'adding_time_start') {
    const time = moment(text, 'HH:mm');
    if (!time.isValid()) {
      await ctx.reply('Пожалуйста, введите корректное время в формате ЧЧ:ММ');
      return;
    }
    ctx.wizard.state.timeStart = time.format('HH:mm');
    ctx.wizard.state.action = 'adding_time_end';
    await ctx.reply('Введите время окончания (формат ЧЧ:ММ):');
    return;
  }

  if (ctx.wizard.state.action === 'adding_time_end') {
    const timeEnd = moment(text, 'HH:mm');
    if (!timeEnd.isValid()) {
      await ctx.reply('Пожалуйста, введите корректное время в формате ЧЧ:ММ');
      return;
    }

    try {
      const master = await Master.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      await Schedule.create({
        masterId: master.id,
        date: ctx.wizard.state.date,
        timeStart: ctx.wizard.state.timeStart,
        timeEnd: timeEnd.format('HH:mm')
      });

      await ctx.reply('Расписание успешно добавлено!');
      await showScheduleMenu(ctx);
      return ctx.wizard.back();
    } catch (error) {
      console.error('Ошибка при сохранении расписания:', error);
      await ctx.reply('Произошла ошибка при сохранении расписания.');
      await showScheduleMenu(ctx);
      return ctx.wizard.back();
    }
  }
});

// Обновляем функцию показа списка расписания
async function showScheduleList(ctx) {
  try {
    const master = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    const schedules = await Schedule.findAll({
      where: {
        masterId: master.id,
        date: {
          [Op.gte]: moment().startOf('day').toDate()
        }
      },
      order: [['date', 'ASC']]
    });

    if (schedules.length === 0) {
      await ctx.reply('У вас пока нет добавленного расписания.');
    } else {
      for (const schedule of schedules) {
        await ctx.reply(
          `📅 Дата: ${moment(schedule.date).format('DD.MM.YYYY')}\n` +
          `⏰ Время: ${schedule.timeStart} - ${schedule.timeEnd}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✏️ Редактировать', callback_data: `edit_schedule_${schedule.id}` },
                  { text: '🗑 Удалить', callback_data: `delete_schedule_${schedule.id}` }
                ]
              ]
            }
          }
        );
      }
    }

    // Показываем нижнее меню после списка
    await ctx.reply('Выберите действие:', {
      reply_markup: {
        keyboard: [
          ['➕ Добавить время', '📋 Просмотреть расписание'],
          ['🔙 Вернуться в меню']
        ],
        resize_keyboard: true
      }
    });
  } catch (error) {
    console.error('Ошибка при получении расписания:', error);
    await ctx.reply('Произошла ошибка при получении расписания.');
    await showScheduleMenu(ctx);
  }
}

// Вспомогательная функция для показа главного меню
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

// Обновляем обработчик для кнопки редактирования
scheduleManagement.action(/^edit_schedule_(\d+)$/, async (ctx) => {
  const scheduleId = ctx.match[1];
  try {
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      await ctx.reply('Расписание не найдено');
      return await showScheduleList(ctx);
    }

    await ctx.reply(
      `Текущее расписание:\n` +
      `📅 Дата: ${moment(schedule.date).format('DD.MM.YYYY')}\n` +
      `⏰ Время: ${schedule.timeStart} - ${schedule.timeEnd}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📅 Изменить дату', callback_data: `edit_date_${scheduleId}` },
              { text: '⏰ Изменить время начала', callback_data: `edit_start_${scheduleId}` }
            ],
            [
              { text: '⏰ Изменить время окончания', callback_data: `edit_end_${scheduleId}` },
              { text: '🔙 Назад', callback_data: 'back_to_schedule' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Ошибка при показе меню редактирования:', error);
    await ctx.reply('Произошла ошибка при загрузке меню редактирования');
    await showScheduleList(ctx);
  }
});

// Обновляем обработчик для полей редактир��вания
scheduleManagement.action(/^edit_(date|start|end)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(console.error);
  const [, field, scheduleId] = ctx.match;
  ctx.wizard.state.editingScheduleId = scheduleId;
  ctx.wizard.state.editingField = field;

  const prompts = {
    date: 'Введите новую дату (формат ДД.ММ.ГГГГ):',
    start: 'Введите новое время начала (формат ЧЧ:ММ):',
    end: 'Введите новое время окончания (формат ЧЧ:ММ):'
  };

  await ctx.reply(prompts[field], {
    reply_markup: { remove_keyboard: true }
  });
});

// Добавляем обработчик для текстовых сообщений при редактировании
scheduleManagement.on('text', async (ctx) => {
  if (ctx.wizard.state.editingField && ctx.wizard.state.editingScheduleId) {
    const field = ctx.wizard.state.editingField;
    const scheduleId = ctx.wizard.state.editingScheduleId;

    try {
      const schedule = await Schedule.findByPk(scheduleId);
      if (!schedule) {
        await ctx.reply('Расписание не найдено');
        return await showScheduleList(ctx);
      }

      let value;
      let isValid = true;

      switch (field) {
        case 'date':
          const date = moment(ctx.message.text, 'DD.MM.YYYY');
          if (!date.isValid()) {
            isValid = false;
            await ctx.reply('Пожалуйста, введите корректную дату в формате ДД.ММ.ГГГГ');
          } else {
            value = date.format('YYYY-MM-DD');
          }
          break;
        case 'start':
        case 'end':
          const time = moment(ctx.message.text, 'HH:mm');
          if (!time.isValid()) {
            isValid = false;
            await ctx.reply('Пожалуйста, введите корректное время в формате ЧЧ:ММ');
          } else {
            value = time.format('HH:mm');
          }
          break;
      }

      if (!isValid) return;

      const updateData = {};
      if (field === 'date') updateData.date = value;
      if (field === 'start') updateData.timeStart = value;
      if (field === 'end') updateData.timeEnd = value;

      try {
        await Schedule.update(updateData, { where: { id: scheduleId } });
        await ctx.reply(`Поле ${field} успешно изменено`);
        await showScheduleList(ctx);
      } catch (error) {
        console.error('Ошибка при редактировании расписания:', error);
        await ctx.reply('Произошла ошибка при редактировании расписания');
        await showScheduleList(ctx);
      }
    } catch (error) {
      console.error('Ошибка при редактировании расписания:', error);
      await ctx.reply('Произошла ошибка при редактировании расписания');
      await showScheduleList(ctx);
    }
  }
});

scheduleManagement.action(/^delete_schedule_(\d+)$/, async (ctx) => {
  try {
    const scheduleId = ctx.match[1];
    await Schedule.destroy({ where: { id: scheduleId } });
    await ctx.reply('Расписание успешно удалено');
    await showScheduleList(ctx);
  } catch (error) {
    console.error('Ошибка при удалении расписания:', error);
    await ctx.reply('Произошла ошибка при удалении расписания');
  }
});

// Добавляем обработчик для возврата к списку
scheduleManagement.action('back_to_schedule', async (ctx) => {
  await showScheduleList(ctx);
});

// Регистрируем middleware для обработки всех сообщений
scheduleManagement.middleware(async (ctx, next) => {
  console.log('Получено сообщение:', ctx.message?.text);
  await next();
});

module.exports = scheduleManagement; 