const { Telegraf, Scenes, session } = require('telegraf');
const { masterRegistration } = require('./scenes/master');
const { clientRegistration } = require('./scenes/client');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const stage = new Scenes.Stage([masterRegistration, clientRegistration]);

bot.use(session());
bot.use(stage.middleware());

bot.command('start', async (ctx) => {
  const masterId = ctx.startPayload; // Получаем ID мастера из ссылки
  
  if (masterId) {
    ctx.session.masterId = masterId;
    await ctx.reply('Добро пожаловать! Для записи к мастеру необходимо зарегистрироваться.');
    return ctx.scene.enter('clientRegistration');
  }

  await ctx.reply('Добро пожаловать! Выберите тип регистрации:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Я мастер', callback_data: 'register_master' },
          { text: 'Я клиент', callback_data: 'register_client' }
        ]
      ]
    }
  });
});

bot.action('register_master', (ctx) => ctx.scene.enter('masterRegistration'));
bot.action('register_client', (ctx) => ctx.scene.enter('clientRegistration'));

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 