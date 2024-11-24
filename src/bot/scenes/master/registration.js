const { Scenes } = require("telegraf");
const { Master } = require("../../../db/models");

const masterRegistration = new Scenes.WizardScene(
  "masterRegistration",
  // Проверка существующего пользователя
  async (ctx) => {
    try {
      const existingMaster = await Master.findOne({
        where: { telegramId: ctx.from.id.toString() },
      });

      if (existingMaster) {
        await ctx.reply("Вы уже зарегистрированы как мастер!");
        return ctx.scene.leave();
      }

      await ctx.reply("Введите ваше имя или название салона:");
      return ctx.wizard.next();
    } catch (error) {
      console.error("Ошибка при проверке существующего мастера:", error);
      await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте еще раз.");
      return ctx.scene.leave();
    }
  },
  // Шаг 2: Запрос телефона
  async (ctx) => {
    ctx.wizard.state.name = ctx.message.text;
    await ctx.reply("Поделитесь вашим номером телефона:", {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Поделиться номером",
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
      },
    });
    return ctx.wizard.next();
  },
  // Шаг 3: Запрос адреса
  async (ctx) => {
    if (!ctx.message.contact) {
      ctx.wizard.state.phone = ctx.message.text;
    } else {
      ctx.wizard.state.phone = ctx.message.contact.phone_number;
    }
    await ctx.reply("Введите адрес салона:", {
      reply_markup: { remove_keyboard: true },
    });
    return ctx.wizard.next();
  },
  // Шаг 4: Запрос описания услуг
  async (ctx) => {
    ctx.wizard.state.address = ctx.message.text;
    await ctx.reply("Введите описание услуг:", {
      reply_markup: { remove_keyboard: true },
    });
    return ctx.wizard.next();
  },
  // Шаг 5: Сохранение данных
  async (ctx) => {
    try {
      ctx.wizard.state.description = ctx.message.text;

      await Master.create({
        telegramId: ctx.from.id.toString(),
        name: ctx.wizard.state.name,
        phone: ctx.wizard.state.phone,
        address: ctx.wizard.state.address,
        description: ctx.wizard.state.description,
      });

      await ctx.reply(
        "Регистрация успешно завершена! Теперь вы можете настроить свои услуги и расписание.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Настроить услуги", callback_data: "setup_services" }],
              [
                {
                  text: "Настроить расписание",
                  callback_data: "setup_schedule",
                },
              ],
            ],
          },
        }
      );

      return ctx.scene.leave();
    } catch (error) {
      console.error(error);
      await ctx.reply("Произошла ошибка при регистрации. Попробуйте еще раз.");
      return ctx.scene.leave();
    }
  }
);

module.exports = masterRegistration;
