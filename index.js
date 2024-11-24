require("dotenv").config();
const { Telegraf, Scenes, session } = require("telegraf");
const moment = require("moment");
const { Op } = require("sequelize");

const {
  masterRegistration,
  serviceManagement,
  scheduleManagement,
  profileSettings,
  broadcast,
} = require("./src/bot/scenes/master");
const {
  clientRegistration,
  appointmentManagement,
  booking,
} = require("./src/bot/scenes/client");

const sequelize = require("./src/db");
const { Master, Client, Service, Appointment } = require("./src/db/models");
const { clientProfileSettings } = require("./src/bot/scenes/client/profileSettings");

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Создание менеджера сцен
const stage = new Scenes.Stage([
  serviceManagement,
  scheduleManagement,
  broadcast,
  profileSettings,
  masterRegistration,
  clientRegistration,
  booking,
  appointmentManagement,
  clientProfileSettings,
]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Обработка команды /start
bot.command("start", async (ctx) => {
  try {
    const masterId = ctx.startPayload;

    // Проверяем, существует ли уже пользователь
    const existingMaster = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    const existingClient = await Client.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    // Если пользователь уже зарегистрирован
    if (existingMaster) {
      return await ctx.reply("Добро пожаловать обратно! Выберите действие:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Управление услугами", callback_data: "setup_services" }],
            [
              {
                text: "Управление расписанием",
                callback_data: "setup_schedule",
              },
            ],
            [{ text: "Мои записи", callback_data: "view_appointments" }],
            [{ text: "Настройки профиля", callback_data: "profile_settings" }],
            [{ text: "Создать рассылк", callback_data: "create_broadcast" }],
          ],
        },
      });
    }

    if (existingClient) {
      return await ctx.reply("Добро пожаловать обратно! Выберите действие:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Записаться", callback_data: "book_appointment" }],
            [{ text: "Мои записи", callback_data: "my_appointments" }],
            [{ text: "Настройки профиля", callback_data: "profile_settings_client" }],
          ],
        },
      });
    }

    // Если это новый пользователь
    if (masterId) {
      ctx.session.masterId = masterId;
      await ctx.reply(
        "Добро пожаловать! Для записи к мастеру необходимо зарегистрироваться."
      );
      return ctx.scene.enter("clientRegistration");
    }

    // Если это первый вход
    await ctx.reply("Добро пожаловать! Выберите тип регистрации:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Я мастер", callback_data: "register_master" },
            { text: "Я клиент", callback_data: "register_client" },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Ошибка при обработке команды start:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте еще раз.");
  }
});

// Добавим команды для быстрого доступа к меню
bot.command("menu", async (ctx) => {
  try {
    const master = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    const client = await Client.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (master) {
      return await ctx.reply("Меню мастера:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Управление услугами", callback_data: "setup_services" }],
            [
              {
                text: "Управление расписанием",
                callback_data: "setup_schedule",
              },
            ],
            [{ text: "Мои записи", callback_data: "view_appointments" }],
            [{ text: "Настройки профиля", callback_data: "profile_settings" }],
            [{ text: "Создать рассылку", callback_data: "create_broadcast" }],
          ],
        },
      });
    }

    if (client) {
      return await ctx.reply("Меню клиента:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Записаться", callback_data: "book_appointment" }],
            [{ text: "Мои записи", callback_data: "my_appointments" }],
            [{ text: "Настройки профиля", callback_data: "profile_settings_client" }],
          ],
        },
      });
    }

    await ctx.reply(
      "Пожалуйста, сначала зарегистрируйтесь, использовав команду /start"
    );
  } catch (error) {
    console.error("Ошибка при обработке команды menu:", error);
    await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте еще раз.");
  }
});

// Обработчики callback-запросов
bot.action("register_master", (ctx) => ctx.scene.enter("masterRegistration"));
bot.action("register_client", (ctx) => ctx.scene.enter("clientRegistration"));

// Добавляем обработчики для управления услугами и расписанием
bot.action("setup_services", async (ctx) => {
  try {
    const master = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!master) {
      return await ctx.reply("Эта функция доступна только для мастеров");
    }

    return ctx.scene.enter("serviceManagement");
  } catch (error) {
    console.error("Ошибка при входе в управление услугами:", error);
    await ctx.reply("Произошла ошибка. Попробуйте еще раз.");
  }
});
bot.action("setup_schedule", (ctx) => ctx.scene.enter("scheduleManagement"));

// Добавляем команду для мастера
bot.command("master_menu", async (ctx) => {
  await ctx.reply("Меню мастера:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Управление услугами", callback_data: "setup_services" }],
        [{ text: "Управление расписанием", callback_data: "setup_schedule" }],
        [{ text: "Мои записи", callback_data: "view_appointments" }],
        [{ text: "Настройки профиля", callback_data: "profile_settings" }],
        [{ text: "Создать рассылку", callback_data: "create_broadcast" }],
      ],
    },
  });
});

// Добавляем обработчики
bot.action("create_broadcast", (ctx) => ctx.scene.enter("broadcast"));
bot.action("profile_settings_master", (ctx) => ctx.scene.enter("profileSettings"));
bot.action("profile_settings_client", (ctx) => ctx.scene.enter("clientProfileSettings"));

// Добавьте эти обработчики после существующих
bot.action("book_appointment", (ctx) => ctx.scene.enter("booking"));
bot.action("my_appointments", (ctx) =>
  ctx.scene.enter("appointmentManagement", { isMaster: false })
);

// Обработчики для подтверждения/отклонения записей
bot.action(/^confirm_appointment_(\d+)$/, async (ctx) => {
  try {
    const appointmentId = ctx.match[1];
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [Client, Service, Master],
    });

    if (!appointment) {
      return await ctx.reply("Запись не нйдена");
    }

    await appointment.update({ status: "confirmed" });

    // Уведомляем клиента
    await ctx.telegram.sendMessage(
      appointment.Client.telegramId,
      `Ваша запись подтверждена!\n
Мастер: ${appointment.Master.name}
Услуга: ${appointment.Service.name}
Дата: ${moment(appointment.date).format("DD.MM.YYYY")}
Время: ${appointment.timeStart}`
    );

    await ctx.reply("Запись подтверждена");
  } catch (error) {
    console.error("Ошибка при подтверждении записи:", error);
    await ctx.reply("Произошла ошибка. Попробуйте еще раз.");
  }
});

bot.action(/^reject_appointment_(\d+)$/, async (ctx) => {
  try {
    const appointmentId = ctx.match[1];
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [Client, Service, Master],
    });

    if (!appointment) {
      return await ctx.reply("Запись не найдена");
    }

    await appointment.update({ status: "cancelled" });

    // Уведомляем клиента
    await ctx.telegram.sendMessage(
      appointment.Client.telegramId,
      `Ваша запись отменена.\n
Мастер: ${appointment.Master.name}
Услуга: ${appointment.Service.name}
Дата: ${moment(appointment.date).format("DD.MM.YYYY")}
Время: ${appointment.timeStart}

Пожалуйста, выберите другое время для записи.`
    );

    await ctx.reply("Запись отменена");
  } catch (error) {
    console.error("Ошибка при отмене записи:", error);
    await ctx.reply("Произошла ошибка. Попробуйте еще раз.");
  }
});

// Добавляем обработчик для просмотра записей
bot.action("view_appointments", async (ctx) => {
  try {
    const master = await Master.findOne({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!master) {
      return await ctx.reply("Доступно только для мастеров");
    }

    const appointments = await Appointment.findAll({
      where: {
        masterId: master.id,
        status: ["pending", "confirmed"],
        date: {
          [Op.gte]: moment().startOf("day").toDate(),
        },
      },
      order: [
        ["date", "ASC"],
        ["timeStart", "ASC"],
      ],
    });

    if (appointments.length === 0) {
      await ctx.reply("У вас пока нет активных записей");
      return;
    }

    for (const app of appointments) {
      const client = await Client.findByPk(app.clientId);
      const service = await Service.findByPk(app.serviceId);

      await ctx.reply(
        `Запись #${app.id}\n` +
          `Клиент: ${client.name}\n` +
          `Услуга: ${service.name}\n` +
          `Дата: ${moment(app.date).format("DD.MM.YYYY")}\n` +
          `Время: ${app.timeStart}\n` +
          `Статус: ${
            app.status === "pending"
              ? "⏳ Ожидает подтверждения"
              : "✅ Подтверждено"
          }`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Подтвердить", callback_data: `confirm_app_${app.id}` },
                { text: "Отменить", callback_data: `cancel_app_${app.id}` },
              ],
            ],
          },
        }
      );
    }
  } catch (error) {
    console.error("Ошибка при получении записей:", error);
    await ctx.reply("Произошла ошибка. Попробуйте еще раз.");
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
  return ctx.reply("Произошла ошибка. Пожалуйста, попробуйте еще раз.");
});

// Функция инициализации базы данных и запуска бота
async function startBot() {
  try {
    // Синхронизация базы данных
    await sequelize.sync({ alter: true });
    console.log("База данных успешно синхронизирована");

    // Запуск бота
    await bot.launch();
    console.log("Бот успешно запущен");

    // Обработка остановки приложения
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error) {
    console.error("Ошибка при запуске:", error);
    process.exit(1);
  }
}

// Запуск приложения
startBot();
