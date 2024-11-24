const { Scenes } = require('telegraf');
const { Master, Client } = require('../../../db/models');

// В начале файла добавляем вспомогательную функцию
async function showMainMenu(ctx) {
  const master = await Master.findOne({
    where: { telegramId: ctx.from.id.toString() }
  });

  if (master) {
    await ctx.reply('Меню мастера:', {
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
}

const profileSettings = new Scenes.WizardScene(
  'profileSettings',
  // Шаг 1: Показ меню настроек
  async (ctx) => {
    try {
      const master = await Master.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      const client = await Client.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      const user = master || client;
      ctx.wizard.state.userType = master ? 'master' : 'client';

      const baseButtons = [
        [{ text: 'Изменить имя', callback_data: 'edit_name' }],
        [{ text: 'Изменить телефон', callback_data: 'edit_phone' }],
        [{ text: 'Вернуться в меню', callback_data: 'back_to_menu' }]
      ];

      // Дополнительные кнопки для мастера
      const masterButtons = [
        [{ text: 'Изменить адрес', callback_data: 'edit_address' }],
        [{ text: 'Изменить описание услуг', callback_data: 'edit_description' }],
        ...baseButtons
      ];

      await ctx.reply(
        `Текущие данные:\n` +
        `Имя: ${user.name}\n` +
        `Телефон: ${user.phone}\n` +
        (master ? `Адрес: ${master.address || 'Не указан'}\n` : '') +
        (master ? `Описание услуг: ${master.description || 'Не указано'}\n` : '') +
        `\nВыберите, что хотите изменить:`,
        {
          reply_markup: {
            inline_keyboard: ctx.wizard.state.userType === 'master' ? masterButtons : baseButtons
          }
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при загрузке настроек профиля:', error);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  },
  // Шаг 2: Обработка выбора настройки
  async (ctx) => {
    if (!ctx.callbackQuery) return;

    const action = ctx.callbackQuery.data;
    
    if (action === 'back_to_menu') {
      await showMainMenu(ctx);
      return ctx.scene.leave();
    }

    ctx.wizard.state.editField = action.replace('edit_', '');
    
    const fieldNames = {
      name: 'имя',
      phone: 'номер телефона',
      address: 'адрес',
      description: 'описание услуг'
    };

    await ctx.reply(`Введите новое ${fieldNames[ctx.wizard.state.editField]}:`);
    return ctx.wizard.next();
  },
  // Шаг 3: Обработка нового значения
  async (ctx) => {
    if (!ctx.message?.text) return;

    try {
      const Model = ctx.wizard.state.userType === 'master' ? Master : Client;
      const user = await Model.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      const updateData = {};
      updateData[ctx.wizard.state.editField] = ctx.message.text;

      await user.update(updateData);

      await ctx.reply('Данные успешно обновлены!');
      
      // Возвращаемся к меню настроек
      ctx.scene.enter('profileSettings');
    } catch (error) {
      console.error('Ошибка при обновлении данных:', error);
      await ctx.reply('Произошла ошибка при обновлении данных. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  }
);

module.exports = profileSettings; 