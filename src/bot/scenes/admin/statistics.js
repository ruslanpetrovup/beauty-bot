const { Scenes } = require('telegraf');
const { Master, Client, Appointment } = require('../../../db/models');
const moment = require('moment');
const { Op } = require('sequelize');
const sequelize = require('../../../db');

const statistics = new Scenes.WizardScene(
  'statistics',
  async (ctx) => {
    await showStatisticsMenu(ctx);
    return ctx.wizard.next();
  }
);

// Показ меню статистики
async function showStatisticsMenu(ctx) {
  await ctx.reply('Меню статистики:', {
    reply_markup: {
      keyboard: [
        ['📊 Количество Мастеров', '👥 Количество Клиентов'],
        ['📈 Использование бота', '📅 Активные дни'],
        ['👑 Топ мастеров', '🛠 Статистика услуг'],
        ['📊 Конверсия записей'],
        ['⬅️ Вернуться в меню']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

// Обработчики статистики
statistics.hears('📊 Количество Мастеров', async (ctx) => {
  try {
    const count = await Master.count();
    await ctx.reply(`📊 Количество зарегистрированных мастеров: ${count}`);
  } catch (error) {
    console.error('Ошибка при подсчете мастеров:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('👥 Количество Клиентов', async (ctx) => {
  try {
    const count = await Client.count();
    await ctx.reply(`📊 Количество зарегистрированных клиентов: ${count}`);
  } catch (error) {
    console.error('Ошибка при подсчете клиентов:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('📈 Использование бота', async (ctx) => {
  try {
    const today = moment().startOf('day');
    const tomorrow = moment(today).add(1, 'days');

    const appointmentsCount = await Appointment.count({
      where: {
        createdAt: {
          [Op.between]: [today.toDate(), tomorrow.toDate()]
        }
      }
    });

    await ctx.reply(`📊 Количество записей за последние 24 часа: ${appointmentsCount}`);
  } catch (error) {
    console.error('Ошибка при подсчете использования:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('📅 Активные дни', async (ctx) => {
  try {
    const appointments = await Appointment.findAll({
      attributes: [
        [sequelize.fn('date_trunc', 'day', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('count', '*'), 'count']
      ],
      group: [sequelize.fn('date_trunc', 'day', sequelize.col('createdAt'))],
      order: [[sequelize.fn('count', '*'), 'DESC']],
      limit: 5
    });

    const daysStats = appointments.map(app => {
      const date = moment(app.getDataValue('date'));
      return `${date.format('DD.MM.YYYY')} (${app.getDataValue('count')} записей)`;
    });

    if (daysStats.length === 0) {
      await ctx.reply('📊 Нет данных за последние 5 дней');
    } else {
      await ctx.reply('📊 Самые активные дни:\n\n' + daysStats.join('\n'));
    }
  } catch (error) {
    console.error('Ошибка при подсчете активных дней:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('👑 Топ мастеров', async (ctx) => {
  try {
    const topMasters = await Appointment.findAll({
      attributes: [
        'masterId',
        [sequelize.fn('COUNT', '*'), 'appointmentCount']
      ],
      include: [{
        model: Master,
        attributes: ['name']
      }],
      group: ['masterId', 'Master.id', 'Master.name'],
      order: [[sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 5
    });

    const response = topMasters.map((master, index) => 
      `${index + 1}. ${master.Master.name}: ${master.getDataValue('appointmentCount')} записей`
    ).join('\n');

    await ctx.reply('📊 Топ-5 самых востребованных мастеров:\n\n' + response);
  } catch (error) {
    console.error('Ошибка при получении топа мастеров:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('🛠 Статистика услуг', async (ctx) => {
  try {
    const servicesStats = await Appointment.findAll({
      attributes: [
        'serviceType',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['serviceType'],
      order: [[sequelize.fn('COUNT', '*'), 'DESC']]
    });

    const response = servicesStats.map(service => 
      `${service.serviceType}: ${service.getDataValue('count')} записей`
    ).join('\n');

    await ctx.reply('📊 Статистика по услугам:\n\n' + response);
  } catch (error) {
    console.error('Ошибка при получении статистики услуг:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('📊 Конверсия записей', async (ctx) => {
  try {
    const totalAppointments = await Appointment.count();
    const completedAppointments = await Appointment.count({
      where: { status: 'completed' }
    });
    const cancelledAppointments = await Appointment.count({
      where: { status: 'cancelled' }
    });

    const conversionRate = ((completedAppointments / totalAppointments) * 100).toFixed(2);
    const cancellationRate = ((cancelledAppointments / totalAppointments) * 100).toFixed(2);

    const response = `📊 Статистика конверсии:\n\n` +
      `Всего записей: ${totalAppointments}\n` +
      `Завершено: ${completedAppointments} (${isNaN(conversionRate) ? 0 : conversionRate}%)\n` +
      `Отменено: ${cancelledAppointments} (${isNaN(cancellationRate) ? 0 : cancellationRate}%)`;

    await ctx.reply(response);
  } catch (error) {
    console.error('Ошибка при получении конверсии:', error);
    await ctx.reply('Произошла ошибка при получении статистики');
  }
});

statistics.hears('⬅️ Вернуться в меню', async (ctx) => {
  await ctx.reply("Добро пожаловать в админку! Выберите действие:", {
    reply_markup: {
      keyboard: [
        ['📊 Статистика'],
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
  return ctx.scene.leave();
});

module.exports = statistics; 