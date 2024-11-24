const { Scenes } = require('telegraf');
const { Service, Master } = require('../../../db/models');

const serviceManagement = new Scenes.WizardScene(
  'serviceManagement',
  // Шаг 1: Показ меню услуг
  async (ctx) => {
    await showServiceMenu(ctx);
    return ctx.wizard.next();
  },
  // Шаг 2: Обработка действий меню
  async (ctx) => {
    if (ctx.message?.text) {
      // Обработка текстовых команд
      const text = ctx.message.text;
      
      if (text === '➕ Добавить услугу') {
        // Сбрасываем состояние редактирования
        ctx.wizard.state.editingServiceId = null;
        ctx.wizard.state.editingField = null;
        
        await ctx.reply('Введите название услуги:', {
          reply_markup: { remove_keyboard: true }
        });
        ctx.wizard.state.action = 'adding_name';
        ctx.wizard.state.serviceData = {};
        return ctx.wizard.next();
      }
      
      if (text === '📋 Посмотреть услуги') {
        await showServicesList(ctx);
        return;
      }
      
      if (text === '🔙 Вернуться в меню') {
        await showMainMenu(ctx);
        return ctx.scene.leave();
      }
      
      if (text === '🔙 Назад к услугам') {
        await showServicesList(ctx);
        return;
      }
      
      // Обработка редактирования
      if (text.startsWith('✏️ Редактировать ')) {
        const serviceId = text.split(' ')[2];
        await showEditMenu(ctx, serviceId);
        return;
      }
      
      // Обработка удаления
      if (text.startsWith('🗑 Удалить ')) {
        const serviceId = text.split(' ')[2];
        await handleDeleteService(ctx, serviceId);
        return;
      }
    }

    // Обработка callback_query
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(console.error);
      const action = ctx.callbackQuery.data;

      if (action === 'back_to_services') {
        // Сбрасываем состояние редактирования при возврате к списку
        ctx.wizard.state.editingServiceId = null;
        ctx.wizard.state.editingField = null;
        await showServicesList(ctx);
        return;
      }

      // Обработка удаления услуги
      if (action.startsWith('delete_service_')) {
        const serviceId = action.split('_')[2];
        await handleDeleteService(ctx, serviceId);
        return;
      }

      // Обработка редактирования услуги
      if (action.startsWith('edit_service_')) {
        const serviceId = action.split('_')[2];
        await showEditMenu(ctx, serviceId);
        return;
      }

      // Обработка редактирования полей
      if (action.startsWith('edit_name_') || 
          action.startsWith('edit_description_') || 
          action.startsWith('edit_price_') || 
          action.startsWith('edit_duration_')) {
        const [, field, serviceId] = action.split('_');
        ctx.wizard.state.editingServiceId = serviceId;
        ctx.wizard.state.editingField = field;
        
        const prompts = {
          name: 'Введите новое название услуги:',
          description: 'Введите новое описание услуги:',
          price: 'Введите новую цену услуги:',
          duration: 'Введите новую длительность услуги (в минутах):'
        };
        
        await ctx.reply(prompts[field]);
        return ctx.wizard.next();
      }
    }
  },
  // Шаг 3: Обработка ввода данных
  async (ctx) => {
    if (!ctx.message?.text) return;

    // Если это редактирование существующей услуги
    if (ctx.wizard.state.editingServiceId) {
      try {
        const service = await Service.findByPk(ctx.wizard.state.editingServiceId);
        if (!service) {
          await ctx.reply('Услуга не найдена');
          return await showServicesList(ctx);
        }

        const field = ctx.wizard.state.editingField;
        let value = ctx.message.text;

        // Валидация введенных данных
        if (field === 'price') {
          value = parseFloat(value);
          if (isNaN(value) || value < 0) {
            await ctx.reply('Пожалуйста, введите корректную цену');
            return;
          }
        } else if (field === 'duration') {
          value = parseInt(value);
          if (isNaN(value) || value <= 0) {
            await ctx.reply('Пожалуйста, введите корректную длительность');
            return;
          }
        }

        const updateData = {};
        updateData[field] = value;
        await service.update(updateData);
        
        // Сбрасываем состояние редактирования после успешного обновления
        ctx.wizard.state.editingServiceId = null;
        ctx.wizard.state.editingField = null;
        
        await ctx.reply('Услуга успешно обновлена!');
        await showServicesList(ctx);
        return ctx.wizard.back();
      } catch (error) {
        // Сбрасываем состояние редактирования при ошибке
        ctx.wizard.state.editingServiceId = null;
        ctx.wizard.state.editingField = null;
        
        console.error('Ошибка при обновлении услуги:', error);
        await ctx.reply('Произошла ошибка при обновлении услуги');
        await showServicesList(ctx);
        return ctx.wizard.back();
      }
    }

    // Если это добавление новой услуги
    const action = ctx.wizard.state.action;
    switch (action) {
      case 'adding_name':
        // Дополнительная проверка
        if (ctx.wizard.state.editingServiceId) {
          ctx.wizard.state.editingServiceId = null;
          ctx.wizard.state.editingField = null;
        }
        
        ctx.wizard.state.serviceData.name = ctx.message.text;
        await ctx.reply('Введите описание услуги:', {
          reply_markup: { remove_keyboard: true }
        });
        ctx.wizard.state.action = 'adding_description';
        return;

      case 'adding_description':
        ctx.wizard.state.serviceData.description = ctx.message.text;
        await ctx.reply('Введите цену услуги:', {
          reply_markup: { remove_keyboard: true }
        });
        ctx.wizard.state.action = 'adding_price';
        return;

      case 'adding_price':
        const price = parseFloat(ctx.message.text);
        if (isNaN(price) || price < 0) {
          await ctx.reply('Пожалуйста, введите корректную цену', {
            reply_markup: { remove_keyboard: true }
          });
          return;
        }
        ctx.wizard.state.serviceData.price = price;
        await ctx.reply('Введите длительность услуги (в минутах):');
        ctx.wizard.state.action = 'adding_duration';
        return;

      case 'adding_duration':
        const duration = parseInt(ctx.message.text);
        if (isNaN(duration) || duration <= 0) {
          await ctx.reply('Пожалуйста, введите корректную длительность');
          return;
        }
        ctx.wizard.state.serviceData.duration = duration;

        try {
          const master = await Master.findOne({
            where: { telegramId: ctx.from.id.toString() }
          });

          await Service.create({
            ...ctx.wizard.state.serviceData,
            masterId: master.id
          });

          await ctx.reply('Услуга успешно добавлена!');
          await showServicesList(ctx);
          return ctx.wizard.back();
        } catch (error) {
          console.error('Ошибка при добавлении услуги:', error);
          await ctx.reply('Произошла ошибка при добавлении услуги');
          await showServicesList(ctx);
          return ctx.wizard.back();
        }
    }
  }
);

// Вспомогательная функция для показа меню редактирования
async function showEditMenu(ctx, serviceId) {
  await ctx.reply('Выберите, что хотите изменить:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Изменить название', callback_data: `edit_name_${serviceId}` },
          { text: 'Изменить описание', callback_data: `edit_description_${serviceId}` }
        ],
        [
          { text: 'Изменить цену', callback_data: `edit_price_${serviceId}` },
          { text: 'Изменить длительность', callback_data: `edit_duration_${serviceId}` }
        ],
        [{ text: 'Назад', callback_data: 'back_to_services' }]
      ]
    }
  });
}

// Вспомогательная функция для удаления услуги
async function handleDeleteService(ctx, serviceId) {
  try {
    await Service.destroy({ where: { id: serviceId } });
    await ctx.reply('Услуга успешно удалена');
    await showServicesList(ctx);
  } catch (error) {
    console.error('Ошибка при удалении услуги:', error);
    await ctx.reply('Произошла ошибка при удалении услуги');
    await showServiceMenu(ctx);
  }
}

// Вспомогательные функции
async function showServiceMenu(ctx) {
  await ctx.reply('Управление услугами:', {
    reply_markup: {
      keyboard: [
        ['➕ Добавить услугу', '📋 Посмотреть услуги'],
        ['🔙 Вернуться в меню']
      ],
      resize_keyboard: true
    }
  });
}

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

async function showServicesList(ctx) {
  try {
    const master = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    const services = await Service.findAll({
      where: { masterId: master.id }
    });

    if (services.length === 0) {
      await ctx.reply('У вас пока нет добавленных услуг');
    } else {
      for (const service of services) {
        await ctx.reply(
          `Название: ${service.name}\n` +
          `Описание: ${service.description}\n` +
          `Цена: ${service.price}₽\n` +
          `Длительность: ${service.duration} мин`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✏️ Редактировать', callback_data: `edit_service_${service.id}` },
                  { text: '🗑 Удалить', callback_data: `delete_service_${service.id}` }
                ]
              ]
            }
          }
        );
      }
    }

    // Показываем нижнее меню после списка услуг
    await ctx.reply('Выберите действие:', {
      reply_markup: {
        keyboard: [
          ['➕ Добавить услугу', '📋 Посмотреть услуги'],
          ['🔙 Вернуться в меню']
        ],
        resize_keyboard: true
      }
    });
  } catch (error) {
    console.error('Ошибка при показе списка услуг:', error);
    await ctx.reply('Произошла ошибка при получении списка услуг');
    await showServiceMenu(ctx);
  }
}

module.exports = serviceManagement;