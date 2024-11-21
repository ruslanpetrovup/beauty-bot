const { Markup } = require('telegraf');

function getMainMenuKeyboard(userType) {
    let buttons = [];

    if (userType === 'master') {
        buttons = [
            ['📊 Управление услугами'],
            ['📅 Мои клиенты'],
            ['⚙️ Настройки'],
            ['👤 Мой профиль'],
            ['🔄 Сменить роль']
        ];
    } else if (userType === 'client') {
        buttons = [
            ['📝 Записаться на услугу'],
            ['📅 Мои записи'],
            ['👤 Мой профиль'],
            ['🔄 Сменить роль']
        ];
    }

    return Markup.keyboard(buttons).resize();
}

module.exports = {
    getMainMenuKeyboard
}; 