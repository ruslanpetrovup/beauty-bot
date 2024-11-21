const { Markup } = require('telegraf');
const clientService = require('../../services/clientService');
const moment = require('moment');
const userService = require('../../services/userService');
const { getMainMenuKeyboard } = require('../keyboards');
const serviceService = require('../../services/serviceService');
const appointmentService = require('../../services/appointmentService');

const registerClientHandlers = (bot) => {
    // Просмотр предстоящих записей
    bot.command('my_appointments', async (ctx) => {
        try {
            const appointments = await clientService.getUpcomingAppointments(ctx.from.id);
            
            if (appointments.rows.length === 0) {
                await ctx.reply('У вас нет предстоящих записей.');
                return;
            }

            for (const apt of appointments.rows) {
                const message = `
                    📅 Запись на ${moment(apt.start_time).format('DD.MM.YYYY HH:mm')}
                    
                    👤 Мастер: ${apt.master_name}
                    🏠 Салон: ${apt.salon_name}
                    📍 Адрес: ${apt.address}
                    💇 Услуга: ${apt.service_name}
                    💰 Стоимость: ${apt.price} грн
                `;

                await ctx.reply(
                    message,
                    Markup.inlineKeyboard([
                        [
                            { 
                                text: '❌ Отменить', 
                                callback_data: `cancel_apt_${apt.id}` 
                            },
                            { 
                                text: '🔄 Перенести', 
                                callback_data: `reschedule_apt_${apt.id}` 
                            }
                        ]
                    ])
                );
            }
        } catch (error) {
            console.error('Error getting appointments:', error);
            await ctx.reply('Произошла ошибка при получении записей.');
        }
    });

    // Управление мастерами
    bot.command('my_masters', async (ctx) => {
        try {
            const masters = await clientService.getFavoriteMasters(ctx.from.id);
            
            if (masters.rows.length === 0) {
                await ctx.reply('У вас пока нет мастеров.');
                return;
            }

            for (const master of masters.rows) {
                const message = `
                    👤 ${master.master_name}
                    🏠 ${master.salon_name}
                    📍 ${master.address}
                    ⭐ Рейтинг: ${master.rating}
                    📊 Количество визитов: ${master.visit_count}
                    📅 Последний визит: ${moment(master.last_visit).format('DD.MM.YYYY')}
                `;

                await ctx.reply(
                    message,
                    Markup.inlineKeyboard([
                        [
                            { 
                                text: '📝 Записаться', 
                                callback_data: `book_master_${master.id}` 
                            },
                            { 
                                text: '❌ Удалить', 
                                callback_data: `remove_master_${master.id}` 
                            }
                        ]
                    ])
                );
            }
        } catch (error) {
            console.error('Error getting masters:', error);
            await ctx.reply('Произошла ошибка при получении списка мастеров.');
        }
    });

    // Настройки клиента
    bot.command('preferences', async (ctx) => {
        try {
            const preferences = await clientService.getClientPreferences(ctx.from.id);
            
            await ctx.reply(
                'Настройки:',
                Markup.keyboard([
                    ['🕒 Предпочтительное время'],
                    ['🔔 Уведомления'],
                    ['💳 Способ оплаты'],
                    ['Назад']
                ]).resize()
            );
        } catch (error) {
            console.error('Error getting preferences:', error);
            await ctx.reply('Произошла ошибка при получении настроек.');
        }
    });

    // Записаться на услугу
    bot.hears('📝 Записаться на услугу', async (ctx) => {
        console.log('Booking service button pressed');
        try {
            // Сначала проверяем наличие мастеров
            const mastersExist = await serviceService.checkMastersExist();
            if (!mastersExist) {
                await ctx.reply('К сожалению, в данный момент нет доступных мастеров. Пожалуйста, попробуйте позже.');
                return;
            }

            await ctx.reply(
                'Выберите категорию услуг:',
                Markup.keyboard([
                    ['💅 Маникюр', '💇‍♀️ Стрижка'],
                    ['💆‍♀️ Массаж', '💄 Макияж'],
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        } catch (error) {
            console.error('Error getting service categories:', error);
            await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    });

    // Обработка выбора категории услуг (используем hears вместо action)
    bot.hears(['💅 Маникюр', '💇‍♀️ Стрижка', '💆‍♀️ Массаж', '💄 Макияж'], async (ctx) => {
        try {
            const categoryName = ctx.message.text;
            const masters = await serviceService.getMastersByCategory(categoryName);
            
            if (!masters || masters.length === 0) {
                await ctx.reply(
                    'В данной категории пока нет доступных мастеров.',
                    Markup.keyboard([
                        ['💅 Маникюр', '💇‍♀️ Стрижка'],
                        ['💆‍♀️ Массаж', '💄 Макияж'],
                        ['⬅️ Назад в главное меню']
                    ]).resize()
                );
                return;
            }

            const keyboard = masters.map(master => ([master.name]));
            keyboard.push(['⬅️ Назад к категориям']);

            await ctx.reply(
                'Выберите мастера:',
                Markup.keyboard(keyboard).resize()
            );
        } catch (error) {
            console.error('Error getting masters:', error);
            await ctx.reply('Произошла ошибка при получении списка мастеров.');
        }
    });

    // Обработка кнопки "Назад к категориям"
    bot.action('back_to_categories', async (ctx) => {
        await ctx.answerCbQuery();
        // Повторно вызываем обработчик кнопки "Записаться на услугу"
        await bot.hears['📝 Записаться на услугу'](ctx);
    });

    // 2. Мои записи
    bot.hears('📅 Мои записи', async (ctx) => {
        console.log('My appointments button pressed');
        await ctx.reply(
            'Ваши записи:',
            Markup.inlineKeyboard([
                [{ text: 'Активные записи', callback_data: 'active_appointments' }],
                [{ text: 'История записей', callback_data: 'appointment_history' }],
                [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
            ])
        );
    });

    // 3. Избранные мастера
    bot.hears('⭐️ Избранные мастера', async (ctx) => {
        console.log('Favorite masters button pressed');
        await ctx.reply(
            'Ваши избранные мастера:',
            Markup.inlineKeyboard([
                [{ text: 'Добавить мастера', callback_data: 'add_favorite_master' }],
                [{ text: 'Посмотреть список', callback_data: 'view_favorite_masters' }],
                [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
            ])
        );
    });

    // 4. Мой профиль
    bot.hears('👤 Мой профиль', async (ctx) => {
        console.log('My profile button pressed');
        try {
            const user = await userService.getUserByTelegramId(ctx.from.id);
            
            if (!user) {
                await ctx.reply(
                    'Профиль не найден. Пожалуйста, зарегистрируйтесь.',
                    Markup.keyboard([
                        ['📝 Регистрация'],
                        ['❌ Отмена']
                    ]).resize()
                );
                return;
            }

            const profileText = `
👤 *Ваш профиль:*
📋 Имя: ${user.name || 'Не указано'}
📱 Телефон: ${user.phone || 'Не указан'}
🕒 Дата регистрации: ${new Date(user.created_at).toLocaleDateString()}`;

            await ctx.reply(profileText, {
                parse_mode: 'Markdown',
                ...Markup.keyboard([
                    ['✏️ Редактировать профиль'],
                    ['⬅️ Назад в главное меню']
                ]).resize()
            });
        } catch (error) {
            console.error('Error getting profile:', error);
            await ctx.reply(
                'Произошла ошибка при получении профиля. Попробуйте позже.',
                Markup.keyboard([
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        }
    });

    // 5. Поддержка
    bot.hears('📞 Поддержка', async (ctx) => {
        console.log('Support button pressed');
        await ctx.reply(
            'Служба поддержки:\n\n' +
            '1. Напишите нам: @support_username\n' +
            '2. Позвоните: +7 (XXX) XXX-XX-XX\n' +
            '3. Или оставьте сообщение прямо здесь',
            Markup.inlineKeyboard([
                [{ text: '✍️ Написать сообщение', callback_data: 'write_support' }],
                [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
            ])
        );
    });

    // Обработка callback_data
    bot.action('back_to_main', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            'Главное меню:',
            getMainMenuKeyboard('client')
        );
    });

    // Добавьте здесь обработчики для остальных callback_data
    bot.action('active_appointments', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply('Загружаем ваши активные записи...');
        // Здесь будет логика получения активных записей
    });

    bot.action('appointment_history', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply('Загружаем историю записей...');
        // Здесь будет логика получения истории записей
    });

    bot.action('edit_profile', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('editProfile');
    });

    bot.action('write_support', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply(
            'Пожалуйста, опишите вашу проблему или вопрос. Мы ответим как можно скорее.',
            Markup.keyboard([['❌ Отменить']]).resize()
        );
        // Здесь нужно добавить логику для обработки сообщения поддержки
    });

    // Обработчик кнопки "Регистрация"
    bot.hears('📝 Регистрация', async (ctx) => {
        console.log('Registration button pressed');
        try {
            // Проверяем, не зарегистрирован ли уже пользователь
            const existingUser = await userService.getUserByTelegramId(ctx.from.id);
            if (existingUser) {
                await ctx.reply(
                    'Вы уже зарегистрированы!',
                    Markup.keyboard([
                        ['👤 Мой профиль'],
                        ['⬅️ Назад в главное меню']
                    ]).resize()
                );
                return;
            }

            // Если пользователь не зарегистрирован, запускаем сцену регистрации
            await ctx.scene.enter('clientRegistration');
        } catch (error) {
            console.error('Error starting registration:', error);
            await ctx.reply(
                'Произошла ошибка при начале регистрации. Попробуйте позже.',
                Markup.keyboard([
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        }
    });

    // Обработчик кнопки "Отмена"
    bot.hears('❌ Отмена', async (ctx) => {
        await ctx.reply(
            'Действие отменено.',
            getMainMenuKeyboard('client')
        );
    });

    // Обработчик кнопки "Редактировать профиль"
    bot.hears('✏️ Редактировать профиль', async (ctx) => {
        console.log('Edit profile button pressed');
        try {
            const user = await userService.getUserByTelegramId(ctx.from.id);
            
            if (!user) {
                await ctx.reply(
                    'Профиль не найден. Пожалуйста, зарегистрируйтесь сначала.',
                    Markup.keyboard([
                        ['📝 Регистрация'],
                        ['⬅️ Назад в главное меню']
                    ]).resize()
                );
                return;
            }

            // Входим в сцену редактирования профиля
            await ctx.scene.enter('editProfile');
        } catch (error) {
            console.error('Error starting profile edit:', error);
            await ctx.reply(
                'Произошла ошибка при редактировании профиля. Попробуйте позже.',
                Markup.keyboard([
                    ['⬅️ Назад в главное меню']
                ]).resize()
            );
        }
    });
};

module.exports = { registerClientHandlers }; 