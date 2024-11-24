const { Scenes } = require('telegraf');
const { Client } = require('../../../db/models');

const clientRegistration = new Scenes.WizardScene(
  'clientRegistration',
  // Шаг 1: Запрос имени
  async (ctx) => {
    await ctx.reply('Введите ваше имя:');
    return ctx.wizard.next();
  },
  // Шаг 2: Запрос телефона
  async (ctx) => {
    ctx.wizard.state.name = ctx.message.text;
    await ctx.reply('Поделитесь вашим номером телефона:', {
      reply_markup: {
        keyboard: [[{
          text: 'Поделиться номером',
          request_contact: true
        }]],
        resize_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Шаг 3: Сохранение данных
  async (ctx) => {
    try {
      if (!ctx.message.contact) {
        ctx.wizard.state.phone = ctx.message.text;
      } else {
        ctx.wizard.state.phone = ctx.message.contact.phone_number;
      }

      await Client.create({
        telegramId: ctx.from.id.toString(),
        name: ctx.wizard.state.name,
        phone: ctx.wizard.state.phone
      });

      await ctx.reply('Регистрация успешно завершена!', {
        reply_markup: { remove_keyboard: true }
      });

      // Если клиент пришел по ссылке мастера
      if (ctx.wizard.state.masterId) {
        await ctx.reply('Хотите записаться к мастеру прямо сейчас?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Да, записаться', callback_data: `book_master_${ctx.wizard.state.masterId}` }],
              [{ text: 'Нет, позже', callback_data: 'main_menu' }]
            ]
          }
        });
      } else {
        await ctx.reply('Добро пожаловать! Выберите действие:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Записаться', callback_data: 'book_appointment' }],
              [{ text: 'Мои записи', callback_data: 'my_appointments' }],
              [{ text: 'Настройки профиля', callback_data: 'profile_settings_client' }]
            ]
          }
        });
      }

      return ctx.scene.leave();
    } catch (error) {
      console.error(error);
      await ctx.reply('Произошла ошибка при регистрации. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  }
); 

module.exports = clientRegistration;