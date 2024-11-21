const moment = require('moment');
const notificationService = require('./notificationService');
const { bot } = require('../bot/bot');

class SessionService {
    async scheduleSessionCompletion(appointmentId) {
        // Планируем отправку сообщения через 15 минут после подтверждения
        setTimeout(async () => {
            try {
                const appointment = await this.getAppointmentDetails(appointmentId);
                if (appointment.status === 'confirmed') {
                    await bot.telegram.sendMessage(
                        appointment.client_telegram_id,
                        'Ваш сеанс завершен?',
                        {
                            reply_markup: {
                                inline_keyboard: [[
                                    { 
                                        text: 'Подтвердить завершение', 
                                        callback_data: `complete_session_${appointmentId}` 
                                    }
                                ]]
                            }
                        }
                    );
                }
            } catch (error) {
                console.error('Error in session completion notification:', error);
            }
        }, 15 * 60 * 1000); // 15 минут
    }

    async getAppointmentDetails(appointmentId) {
        const query = `
            SELECT 
                a.*,
                u.telegram_id as client_telegram_id
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            WHERE a.id = $1
        `;
        const result = await db.query(query, [appointmentId]);
        return result.rows[0];
    }
}

module.exports = new SessionService(); 