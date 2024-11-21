const db = require('../database/db');
const securityService = require('./securityService');
const loggingService = require('./loggingService');
const cacheService = require('./cacheService');

class AdminService {
    async getSystemStats() {
        const stats = await cacheService.getOrSet('system_stats', async () => {
            const queries = {
                users: 'SELECT COUNT(*) FROM users',
                masters: 'SELECT COUNT(*) FROM masters',
                clients: 'SELECT COUNT(*) FROM clients',
                appointments: 'SELECT COUNT(*) FROM appointments',
                activeUsers: `
                    SELECT COUNT(DISTINCT user_id) 
                    FROM user_sessions 
                    WHERE last_activity > NOW() - INTERVAL '24 hours'
                `,
                errors: `
                    SELECT COUNT(*) 
                    FROM error_logs 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                `
            };

            const results = {};
            for (const [key, query] of Object.entries(queries)) {
                const result = await db.query(query);
                results[key] = parseInt(result.rows[0].count);
            }

            return results;
        }, 300); // Кэшируем на 5 минут

        return stats;
    }

    async getErrorLogs(filters = {}) {
        const query = `
            SELECT 
                id,
                error_type,
                error_message,
                stack_trace,
                context,
                created_at
            FROM error_logs
            WHERE 
                ($1::text IS NULL OR error_type = $1)
                AND ($2::timestamp IS NULL OR created_at >= $2)
                AND ($3::timestamp IS NULL OR created_at <= $3)
            ORDER BY created_at DESC
            LIMIT $4 OFFSET $5
        `;

        return db.query(query, [
            filters.type,
            filters.dateFrom,
            filters.dateTo,
            filters.limit || 50,
            filters.offset || 0
        ]);
    }

    async getActiveUsers() {
        const query = `
            SELECT 
                u.id,
                u.name,
                u.role,
                s.device_info,
                s.ip_address,
                s.last_activity
            FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.last_activity > NOW() - INTERVAL '15 minutes'
            ORDER BY s.last_activity DESC
        `;

        return db.query(query);
    }

    async blockUser(userId, reason) {
        await db.query(
            'UPDATE users SET status = $1, blocked_reason = $2 WHERE id = $3',
            ['blocked', reason, userId]
        );

        await securityService.terminateUserSessions(userId);
        
        loggingService.logEvent('user_blocked', {
            userId,
            reason,
            adminId: this.currentAdminId
        });
    }

    async unblockUser(userId) {
        await db.query(
            'UPDATE users SET status = $1, blocked_reason = NULL WHERE id = $2',
            ['active', userId]
        );

        loggingService.logEvent('user_unblocked', {
            userId,
            adminId: this.currentAdminId
        });
    }

    async clearUserData(userId) {
        const queries = [
            'DELETE FROM appointments WHERE client_id = $1',
            'DELETE FROM client_preferences WHERE client_id = $1',
            'DELETE FROM reviews WHERE client_id = $1',
            'DELETE FROM notifications WHERE user_id = $1',
            'DELETE FROM user_sessions WHERE user_id = $1'
        ];

        for (const query of queries) {
            await db.query(query, [userId]);
        }

        loggingService.logEvent('user_data_cleared', {
            userId,
            adminId: this.currentAdminId
        });
    }
}

module.exports = new AdminService(); 