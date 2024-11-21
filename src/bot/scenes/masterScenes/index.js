const { Scenes } = require('telegraf');
const { Markup } = require('telegraf');

const masterRegistrationScene = new Scenes.WizardScene(
    'masterRegistration',
    // Шаг 1: Ввод имени
    async (ctx) => {
        await ctx.reply('Введите ваше имя:');
        return ctx.wizard.next();
    },
    // Шаг 2: Ввод телефона
    async (ctx) => {
        if (!ctx.message?.text) return;
        
        ctx.wizard.state.name = ctx.message.text;
        await ctx.reply('Введите ваш номер телефона:');
        return ctx.wizard.next();
    },
    // Шаг 3: Название салона
    async (ctx) => {
        if (!ctx.message?.text) return;
        
        ctx.wizard.state.phone = ctx.message.text;
        await ctx.reply('Введите название вашего салона:');
        return ctx.wizard.next();
    },
    // Шаг 4: Адрес
    async (ctx) => {
        if (!ctx.message?.text) return;
        
        ctx.wizard.state.salonName = ctx.message.text;
        await ctx.reply('Введите адрес салона:');
        return ctx.wizard.next();
    },
    // Шаг 5: Платежные реквизиты
    async (ctx) => {
        if (!ctx.message?.text) return;
        
        ctx.wizard.state.address = ctx.message.text;
        await ctx.reply('Введите ваш IBAN для приема платежей:');
        return ctx.wizard.next();
    },
    // Шаг 6: Сохранение данных
    require('./masterScenes/masterRegistrationStep6')
);

module.exports = {
    masterRegistrationScene,
    addServiceScene,
    editServicesScene,
    deleteServiceScene
}; 