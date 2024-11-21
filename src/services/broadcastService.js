const db = require('../database/db');
const bot = require('../bot/bot');
const moment = require('moment');

class BroadcastService {
    async createBroadcast(masterId, message, options = {}) {
        const query = `
            INSERT INTO broadcasts (
                master_id, 
                message, 
                target_group,
                scheduled_for,
                status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        
        const result = await db.query(query, [
            masterId,
            message,
            options.targetGroup || 'all',
            options.scheduledFor || new Date(),
            options.scheduledFor ? 'scheduled' : 'pending'
        ]);

        if (!options.scheduledFor) {
            await this.sendBroadcast(result.rows[0].id);
        }

        return result.rows[0];
    }

    async sendBroadcast(broadcastId) {
        const broadcast = await this.getBroadcastDetails(broadcastId);
        const recipients = await this.getRecipients(
            broadcast.master_id,
            broadcast.target_group
        );

        let successCount = 0;
        let failureCount = 0;

        for (const recipient of recipients) {
            try {
                await bot.telegram.sendMessage(
                    recipient.telegram_id,
                    broadcast.message,
                    { parse_mode: 'HTML' }
                );
                successCount++;
                await this.logDelivery(broadcastId, recipient.id, true);
            } catch (error) {
                console.error(`Failed to send broadcast to ${recipient.id}:`, error);
                failureCount++;
                await this.logDelivery(broadcastId, recipient.id, false, error.message);
            }

            // Добавляем задержку между сообщениями
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        await this.updateBroadcastStatus(broadcastId, {
            status: 'completed',
            success_count: successCount,
            failure_count: failureCount
        });

        return { successCount, failureCount };
    }

    async getRecipients(masterId, targetGroup) {
        let query = `
            SELECT DISTINCT 
                u.id,
                u.telegram_id
            FROM users u
            JOIN appointments a ON a.client_id = u.id
            WHERE 
                a.master_id = $1
                AND u.is_active = true
                AND u.telegram_id IS NOT NULL
        `;

        if (targetGroup === 'recent') {
            query += ` AND a.start_time >= NOW() - INTERVAL '3 months'`;
        } else if (targetGroup === 'upcoming') {
            query += ` AND a.start_time > NOW() AND a.status = 'confirmed'`;
        }

        const result = await db.query(query, [masterId]);
        return result.rows;
    }

    async logDelivery(broadcastId, userId, success, error = null) {
        const query = `
            INSERT INTO broadcast_logs (
                broadcast_id,
                user_id,
                success,
                error_message,
                sent_at
            )
            VALUES ($1, $2, $3, $4, NOW())
        `;
        
        return db.query(query, [broadcastId, userId, success, error]);
    }

    async updateBroadcastStatus(broadcastId, data) {
        const query = `
            UPDATE broadcasts
            SET 
                status = $2,
                success_count = $3,
                failure_count = $4,
                completed_at = NOW()
            WHERE id = $1
        `;
        
        return db.query(query, [
            broadcastId,
            data.status,
            data.success_count,
            data.failure_count
        ]);
    }

    async getBroadcastDetails(broadcastId) {
        const query = `
            SELECT * FROM broadcasts WHERE id = $1
        `;
        
        const result = await db.query(query, [broadcastId]);
        return result.rows[0];
    }

    async getBroadcastStats(masterId) {
        const query = `
            SELECT 
                COUNT(*) as total_broadcasts,
                SUM(success_count) as total_delivered,
                SUM(failure_count) as total_failed,
                AVG(success_count::float / NULLIF(success_count + failure_count, 0)) as average_success_rate
            FROM broadcasts
            WHERE master_id = $1 AND status = 'completed'
        `;
        
        const result = await db.query(query, [masterId]);
        return result.rows[0];
    }
}

module.exports = new BroadcastService(); 