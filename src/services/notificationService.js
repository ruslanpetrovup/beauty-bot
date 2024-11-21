const { bot } = require('../bot/bot');
const db = require('../database/db');
const moment = require('moment');

class NotificationService {
    async scheduleReminders() {
        // Проверяем записи каждый час
        setInterval(async () => {
            try {
                await this.sendDayBeforeReminders();
            } catch (error) {
                console.error('Error in reminder scheduler:', error);
            }
        }, 60 * 60 * 1000); // каждый час
    }

    async sendDayBeforeReminders() {
        const query = `
            SELECT 
                a.*,
                u.telegram_id as client_telegram_id,
                m.salon_name,
                mu.name as master_name,
                s.name as service_name
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            JOIN masters m ON a.master_id = m.id
            JOIN users mu ON m.user_id = mu.id
            JOIN services s ON a.service_id = s.id
            WHERE 
                a.status = 'confirmed' 
                AND a.start_time BETWEEN NOW() + INTERVAL '23 hours' 
                AND NOW() + INTERVAL '25 hours'
                AND a.reminder_sent = false
        `;

        const result = await db.query(query);

        for (const appointment of result.rows) {
            await this.sendAppointmentReminder(appointment);
            await this.markReminderSent(appointment.id);
        }
    }

    async sendAppointmentReminder(appointment) {
        const message = `
            📅 Напоминание о записи!

            Завтра у вас запись:
            👤 Мастер: ${appointment.master_name}
            🏠 Салон: ${appointment.salon_name}
            💇 Услуга: ${appointment.service_name}
            🕒 Время: ${moment(appointment.start_time).format('DD.MM.YYYY HH:mm')}

            Пожалуйста, подтвердите ваш визит:
        `;

        await bot.telegram.sendMessage(
            appointment.client_telegram_id,
            message,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Подтверждаю", callback_data: `confirm_visit_${appointment.id}` },
                            { text: "❌ Отменить", callback_data: `cancel_visit_${appointment.id}` }
                        ],
                        [
                            { text: "🔄 Перенести", callback_data: `reschedule_visit_${appointment.id}` }
                        ]
                    ]
                }
            }
        );
    }

    async notifyMasterAboutCancellation(appointment, reason) {
        const query = `
            SELECT u.telegram_id
            FROM masters m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = $1
        `;
        
        const result = await db.query(query, [appointment.master_id]);
        const masterTelegramId = result.rows[0]?.telegram_id;

        if (masterTelegramId) {
            const message = `
                ❌ Отмена записи!

                Клиент ${appointment.client_name} отменил запись:
                📅 Дата: ${moment(appointment.start_time).format('DD.MM.YYYY')}
                🕒 Время: ${moment(appointment.start_time).format('HH:mm')}
                💇 Услуга: ${appointment.service_name}
                
                Причина: ${reason || 'Не указана'}
            `;

            await bot.telegram.sendMessage(masterTelegramId, message);
        }
    }

    async markReminderSent(appointmentId) {
        await db.query(
            'UPDATE appointments SET reminder_sent = true WHERE id = $1',
            [appointmentId]
        );
    }
}

module.exports = new NotificationService();