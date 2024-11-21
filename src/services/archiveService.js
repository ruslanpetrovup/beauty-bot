const db = require('../database/db');
const moment = require('moment');

class ArchiveService {
    async getClientArchive(clientId) {
        const query = `
            SELECT 
                a.*,
                m.salon_name,
                mu.name as master_name,
                s.name as service_name,
                s.price,
                r.rating,
                r.comment as review_comment
            FROM appointments a
            JOIN masters m ON a.master_id = m.id
            JOIN users mu ON m.user_id = mu.id
            JOIN services s ON a.service_id = s.id
            LEFT JOIN reviews r ON r.appointment_id = a.id
            WHERE 
                a.client_id = $1 
                AND a.status = 'completed'
            ORDER BY a.start_time DESC
        `;
        
        return db.query(query, [clientId]);
    }

    async getMasterArchive(masterId, filters = {}) {
        let query = `
            SELECT 
                a.*,
                u.name as client_name,
                u.phone as client_phone,
                s.name as service_name,
                s.price,
                r.rating,
                r.comment as review_comment
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            JOIN services s ON a.service_id = s.id
            LEFT JOIN reviews r ON r.appointment_id = a.id
            WHERE 
                a.master_id = $1 
                AND a.status = 'completed'
        `;

        const queryParams = [masterId];
        
        if (filters.dateFrom) {
            query += ` AND a.start_time >= $${queryParams.length + 1}`;
            queryParams.push(filters.dateFrom);
        }
        
        if (filters.dateTo) {
            query += ` AND a.start_time <= $${queryParams.length + 1}`;
            queryParams.push(filters.dateTo);
        }

        query += ` ORDER BY a.start_time DESC`;

        return db.query(query, queryParams);
    }

    async getMasterStatistics(masterId, period = '30days') {
        const dateFrom = moment().subtract(
            period === '30days' ? 30 : 
            period === '90days' ? 90 : 
            365, 'days'
        ).format('YYYY-MM-DD');

        const query = `
            WITH stats AS (
                SELECT 
                    COUNT(*) as total_appointments,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
                    AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END) as average_rating,
                    SUM(s.price) as total_revenue
                FROM appointments a
                LEFT JOIN reviews r ON r.appointment_id = a.id
                JOIN services s ON a.service_id = s.id
                WHERE 
                    a.master_id = $1
                    AND a.start_time >= $2
            )
            SELECT 
                *,
                ROUND(CAST(cancelled_appointments AS FLOAT) / 
                    NULLIF(total_appointments, 0) * 100, 2) as cancellation_rate,
                ROUND(CAST(completed_appointments AS FLOAT) / 
                    NULLIF(total_appointments, 0) * 100, 2) as completion_rate
            FROM stats
        `;

        return db.query(query, [masterId, dateFrom]);
    }
}

module.exports = new ArchiveService(); 