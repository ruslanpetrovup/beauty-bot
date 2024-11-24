const { Scenes } = require('telegraf');
const { Client, Appointment } = require('../../../db/models');

async function showProfileMenu(ctx, client) {
  await ctx.reply(
    `📋 Ваш профиль:\n\nИмя: ${client.name}\nТелефон: ${client.phone}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Изменить имя', callback_data: 'edit_name' }],
          [{ text: '📱 Изменить телефон', callback_data: 'edit_phone' }],
          [{ text: '🗑 Удалить профиль', callback_data: 'delete_profile' }],
          [{ text: '🔙 Вернуться в меню', callback_data: 'back_to_menu' }]
        ]
      }
    }
  );
}

const clientProfileSettings = new Scenes.WizardScene(
  'clientProfileSettings',
  // Шаг 1: Показ меню настроек
  async (ctx) => {
    try {
      const client = await Client.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      if (!client) {
        await ctx.reply('Профиль не найден');
        return ctx.scene.leave();
      }

      await showProfileMenu(ctx, client);
      return ctx.wizard.next();
    } catch (error) {
      console.error('Ошибка при загрузке профиля:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
      return ctx.scene.leave();
    }
  },
  // Шаг 2: Обработка выбора действия
  async (ctx) => {
    if (!ctx.callbackQuery) return;

    const action = ctx.callbackQuery.data;
    const client = await Client.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    switch (action) {
      case 'edit_name':
        await ctx.reply('Введите новое имя:');
        ctx.wizard.state.action = 'edit_name';
        return ctx.wizard.next();

      case 'edit_phone':
        await ctx.reply('Введите новый номер телефона:', {
          reply_markup: {
            keyboard: [[{
              text: 'Поделиться номером',
              request_contact: true
            }]],
            resize_keyboard: true
          }
        });
        ctx.wizard.state.action = 'edit_phone';
        return ctx.wizard.next();

      case 'delete_profile':
        await ctx.reply('Вы уверены, что хотите удалить свой профиль? Это действие нельзя отменить.', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Да, удалить', callback_data: 'confirm_delete' },
                { text: 'Нет, отменить', callback_data: 'cancel_delete' }
              ]
            ]
          }
        });
        ctx.wizard.state.action = 'delete_profile';
        return ctx.wizard.next();

      case 'back_to_menu':
        await ctx.reply('Главное меню:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Записаться", callback_data: "book_appointment" }],
              [{ text: "Мои записи", callback_data: "my_appointments" }],
              [{ text: "Настройки профиля", callback_data: "profile_settings_client" }]
            ]
          }
        });
        return ctx.scene.leave();
    }
  },
  // Шаг 3: Обработка изменений
  async (ctx) => {
    try {
      const client = await Client.findOne({
        where: { telegramId: ctx.from.id.toString() }
      });

      switch (ctx.wizard.state.action) {
        case 'edit_name':
          await client.update({ name: ctx.message.text });
          await ctx.reply('Имя успешно обновлено!', { reply_markup: { remove_keyboard: true } });
          break;

        case 'edit_phone':
          const phone = ctx.message.contact ? 
            ctx.message.contact.phone_number : 
            ctx.message.text;
          await client.update({ phone });
          await ctx.reply('Телефон успешно обновлен!', { reply_markup: { remove_keyboard: true } });
          break;

        case 'delete_profile':
          if (ctx.callbackQuery.data === 'confirm_delete') {
            // Проверяем активные записи
            const activeAppointments = await Appointment.findOne({
              where: {
                clientId: client.id,
                status: ['pending', 'confirmed']
              }
            });

            if (activeAppointments) {
              await ctx.reply('Невозможно удалить профиль, у вас есть активные записи.');
            } else {
              await client.destroy();
              await ctx.reply('Ваш профиль был успешно удален. Если захотите вернуться, используйте команду /start');
              return ctx.scene.leave();
            }
          }
          break;
      }

      await showProfileMenu(ctx, client);
      return ctx.wizard.selectStep(1);
    } catch (error) {
      console.error('Ошибка при обновлении профиля:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
      return ctx.scene.leave();
    }
  }
);

// Обработчик для всех callback_query
clientProfileSettings.action(/.+/, (ctx) => {
  return ctx.wizard.steps[ctx.wizard.cursor](ctx);
});

module.exports = { clientProfileSettings }; 