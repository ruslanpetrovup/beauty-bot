const db = require('../database/db');
const bot = require('../bot/bot');
const moment = require('moment');

class EventNotificationService {
    async handleBusinessEvent(event) {
        try {
            // Сохраняем событие
            await this.saveEvent(event);

            // Определяем получателей уведомления
            const recipients = await this.getEventRecipients(event);

            // Формируем и отправляем уведомления
            for (const recipient of recipients) {
                const message = this.formatEventMessage(event);
                await this.sendNotification(recipient, message, event);
            }

            // Логируем отправку уведомлений
            await this.logNotificationsSent(event, recipients);
        } catch (error) {
            console.error('Error handling business event:', error);
        }
    }

    async saveEvent(event) {
        const query = `
            INSERT INTO business_events (
                type,
                severity,
                data,
                master_id,
                created_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
        `;

        const result = await db.query(query, [
            event.type,
            event.severity,
            event.data,
            event.masterId
        ]);

        return result.rows[0].id;
    }

    async getEventRecipients(event) {
        const query = `
            SELECT DISTINCT
                u.id,
                u.telegram_id,
                u.notification_settings
            FROM users u
            LEFT JOIN masters m ON u.id = m.user_id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE 
                (m.id = $1 OR e.master_id = $1)
                AND u.notification_settings->$2 = 'true'
                AND u.telegram_id IS NOT NULL
        `;

        const result = await db.query(query, [
            event.masterId,
            event.type
        ]);

        return result.rows;
    }

    formatEventMessage(event) {
        const severityIcons = {
            high: '🚨',
            medium: '⚠️',
            low: 'ℹ️'
        };

        const typeMessages = {
            low_inventory: (data) => `
                ${severityIcons[event.severity]} Низкий остаток товара
                
                Товар: ${data.itemName}
                Текущий остаток: ${data.currentQuantity} ${data.unit}
                Минимальный остаток: ${data.minimumQuantity} ${data.unit}
            `,
            
            financial_alert: (data) => `
                ${severityIcons[event.severity]} Финансовое уведомление
                
                Тип: ${data.alertType}
                Период: ${data.period}
                Показатель: ${data.metric}
                Текущее значение: ${data.currentValue}
                ${data.threshold ? `Пороговое значение: ${data.threshold}` : ''}
            `,
            
            client_complaint: (data) => `
                ${severityIcons[event.severity]} Жалоба клиента
                
                Клиент: ${data.clientName}
                Услуга: ${data.serviceName}
                Дата: ${moment(data.appointmentDate).format('DD.MM.YYYY')}
                Причина: ${data.reason}
                ${data.comment ? `Комментарий: ${data.comment}` : ''}
            `,
            
            security_alert: (data) => `
                ${severityIcons[event.severity]} Предупреждение безопасности
                
                Тип: ${data.alertType}
                IP: ${data.ip}
                Время: ${moment(data.timestamp).format('DD.MM.YYYY HH:mm:ss')}
                ${data.details ? `Детали: ${data.details}` : ''}
            `
        };

        return typeMessages[event.type](event.data);
    }

    async sendNotification(recipient, message, event) {
        try {
            const keyboard = this.getEventKeyboard(event);
            
            await bot.telegram.sendMessage(
                recipient.telegram_id,
                message.trim(),
                keyboard ? { reply_markup: keyboard } : {}
            );
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    getEventKeyboard(event) {
        const keyboards = {
            low_inventory: Markup.inlineKeyboard([
                [{ text: '📦 Заказать товар', callback_data: `order_item_${event.data.itemId}` }],
                [{ text: '📊 Статистика расхода', callback_data: `item_stats_${event.data.itemId}` }]
            ]),
            
            financial_alert: Markup.inlineKeyboard([
                [{ text: '📊 Подробный отчет', callback_data: `fin_report_${event.data.period}` }],
                [{ text: '⚙️ Настройки оповещений', callback_data: 'alert_settings' }]
            ]),
            
            client_complaint: Markup.inlineKeyboard([
                [{ text: '👤 Информация о клиенте', callback_data: `client_info_${event.data.clientId}` }],
                [{ text: '📝 Ответить', callback_data: `reply_complaint_${event.id}` }]
            ])
        };

        return keyboards[event.type];
    }

    async logNotificationsSent(event, recipients) {
        const query = `
            INSERT INTO notification_logs (
                event_id,
                recipient_ids,
                sent_at
            )
            VALUES ($1, $2, NOW())
        `;

        await db.query(query, [
            event.id,
            recipients.map(r => r.id)
        ]);
    }
}

module.exports = new EventNotificationService(); 