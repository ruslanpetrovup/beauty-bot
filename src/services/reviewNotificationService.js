const db = require('../database/db');
const bot = require('../bot/bot');

class ReviewNotificationService {
    async handleNewReview(review) {
        try {
            // Получаем детали записи и мастера
            const appointmentDetails = await this.getAppointmentDetails(review.appointment_id);
            
            // Отправляем уведомление мастеру
            await this.notifyMaster(appointmentDetails, review);
            
            // Обновляем статистику мастера
            await this.updateMasterStatistics(appointmentDetails.master_id);
            
            // Если оценка низкая, отправляем дополнительное уведомление
            if (review.rating <= 3) {
                await this.notifyAboutLowRating(appointmentDetails, review);
            }
        } catch (error) {
            console.error('Error handling new review:', error);
        }
    }

    async notifyMaster(appointment, review) {
        const message = `
            🌟 Новый отзыв!

            Клиент: ${appointment.client_name}
            Услуга: ${appointment.service_name}
            Дата: ${appointment.formatted_date}
            
            Оценка: ${'⭐'.repeat(review.rating)}
            ${review.comment ? `\nКомментарий: ${review.comment}` : ''}
        `;

        await bot.telegram.sendMessage(
            appointment.master_telegram_id,
            message,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: 'Посмотреть все отзывы',
                            callback_data: 'view_all_reviews'
                        }
                    ]]
                }
            }
        );
    }

    async notifyAboutLowRating(appointment, review) {
        const adminMessage = `
            ⚠️ Внимание! Получен низкий рейтинг!

            Мастер: ${appointment.master_name}
            Клиент: ${appointment.client_name}
            Услуга: ${appointment.service_name}
            Дата: ${appointment.formatted_date}
            
            Оценка: ${review.rating}/5
            ${review.comment ? `\nКомментарий: ${review.comment}` : ''}
        `;

        // Отправка уведомления администратору
        if (process.env.ADMIN_TELEGRAM_ID) {
            await bot.telegram.sendMessage(
                process.env.ADMIN_TELEGRAM_ID,
                adminMessage
            );
        }
    }

    async updateMasterStatistics(masterId) {
        const query = `
            WITH stats AS (
                SELECT 
                    COUNT(*) as total_reviews,
                    AVG(r.rating) as average_rating,
                    COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_reviews
                FROM reviews r
                JOIN appointments a ON r.appointment_id = a.id
                WHERE a.master_id = $1
            )
            UPDATE masters
            SET 
                review_count = stats.total_reviews,
                average_rating = stats.average_rating,
                five_star_count = stats.five_star_reviews
            FROM stats
            WHERE id = $1
            RETURNING *
        `;

        return db.query(query, [masterId]);
    }

    async getAppointmentDetails(appointmentId) {
        const query = `
            SELECT 
                a.*,
                u.name as client_name,
                mu.name as master_name,
                mu.telegram_id as master_telegram_id,
                s.name as service_name,
                to_char(a.start_time, 'DD.MM.YYYY HH24:MI') as formatted_date
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            JOIN masters m ON a.master_id = m.id
            JOIN users mu ON m.user_id = mu.id
            JOIN services s ON a.service_id = s.id
            WHERE a.id = $1
        `;

        const result = await db.query(query, [appointmentId]);
        return result.rows[0];
    }
}

module.exports = new ReviewNotificationService(); 