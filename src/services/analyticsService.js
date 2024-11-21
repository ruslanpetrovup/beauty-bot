const db = require('../database/db');
const moment = require('moment');
const loggingService = require('./loggingService');
const cacheService = require('./cacheService');

class AnalyticsService {
    async getBusinessMetrics(masterId, period = '30days') {
        const cacheKey = `analytics:business:${masterId}:${period}`;
        
        return cacheService.getOrSet(cacheKey, async () => {
            const dateFrom = moment().subtract(
                parseInt(period),
                period.replace(/\d+/, '')
            ).format('YYYY-MM-DD');

            const metrics = await this.measureDbQuery('business_metrics', async () => {
                const query = `
                    WITH appointment_stats AS (
                        SELECT 
                            COUNT(*) as total_appointments,
                            COUNT(DISTINCT client_id) as unique_clients,
                            SUM(price) as total_revenue,
                            AVG(price) as average_check,
                            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancellations
                        FROM appointments
                        WHERE 
                            master_id = $1 
                            AND created_at >= $2
                    ),
                    service_stats AS (
                        SELECT 
                            s.name,
                            COUNT(*) as usage_count,
                            SUM(a.price) as service_revenue
                        FROM appointments a
                        JOIN services s ON a.service_id = s.id
                        WHERE 
                            a.master_id = $1 
                            AND a.created_at >= $2
                            AND a.status = 'completed'
                        GROUP BY s.id, s.name
                        ORDER BY usage_count DESC
                        LIMIT 5
                    ),
                    client_retention AS (
                        SELECT 
                            COUNT(DISTINCT client_id) as returning_clients
                        FROM appointments
                        WHERE 
                            master_id = $1 
                            AND created_at >= $2
                            AND client_id IN (
                                SELECT client_id
                                FROM appointments
                                WHERE master_id = $1
                                GROUP BY client_id
                                HAVING COUNT(*) > 1
                            )
                    )
                    SELECT 
                        a.*,
                        array_agg(json_build_object(
                            'name', s.name,
                            'count', s.usage_count,
                            'revenue', s.service_revenue
                        )) as top_services,
                        r.returning_clients
                    FROM appointment_stats a
                    CROSS JOIN client_retention r
                    LEFT JOIN service_stats s ON true
                    GROUP BY 
                        a.total_appointments, 
                        a.unique_clients,
                        a.total_revenue,
                        a.average_check,
                        a.cancellations,
                        r.returning_clients
                `;

                const result = await db.query(query, [masterId, dateFrom]);
                return result.rows[0];
            });

            return {
                ...metrics,
                retention_rate: (metrics.returning_clients / metrics.unique_clients * 100).toFixed(2),
                cancellation_rate: (metrics.cancellations / metrics.total_appointments * 100).toFixed(2)
            };
        }, 3600); // Кэшируем на 1 час
    }

    async getClientAnalytics(masterId, clientId) {
        const query = `
            WITH client_history AS (
                SELECT 
                    COUNT(*) as visit_count,
                    MIN(created_at) as first_visit,
                    MAX(created_at) as last_visit,
                    SUM(price) as total_spent,
                    AVG(price) as average_check,
                    array_agg(DISTINCT service_id) as used_services
                FROM appointments
                WHERE 
                    master_id = $1 
                    AND client_id = $2
                    AND status = 'completed'
            ),
            preferred_times AS (
                SELECT 
                    EXTRACT(DOW FROM start_time) as day_of_week,
                    EXTRACT(HOUR FROM start_time) as hour,
                    COUNT(*) as slot_count
                FROM appointments
                WHERE 
                    master_id = $1 
                    AND client_id = $2
                GROUP BY day_of_week, hour
                ORDER BY slot_count DESC
                LIMIT 3
            )
            SELECT 
                ch.*,
                array_agg(json_build_object(
                    'day', pt.day_of_week,
                    'hour', pt.hour,
                    'count', pt.slot_count
                )) as preferred_slots
            FROM client_history ch
            CROSS JOIN preferred_times pt
            GROUP BY 
                ch.visit_count,
                ch.first_visit,
                ch.last_visit,
                ch.total_spent,
                ch.average_check,
                ch.used_services
        `;

        const result = await db.query(query, [masterId, clientId]);
        return result.rows[0];
    }

    async getRevenueAnalytics(masterId, period = '12months') {
        const query = `
            SELECT 
                DATE_TRUNC($3, created_at) as period,
                COUNT(*) as appointments,
                SUM(price) as revenue,
                AVG(price) as average_check,
                COUNT(DISTINCT client_id) as unique_clients
            FROM appointments
            WHERE 
                master_id = $1
                AND created_at >= $2
                AND status = 'completed'
            GROUP BY DATE_TRUNC($3, created_at)
            ORDER BY period DESC
        `;

        const dateFrom = moment().subtract(
            parseInt(period),
            period.replace(/\d+/, '')
        ).format('YYYY-MM-DD');

        const periodUnit = period.includes('month') ? 'month' : 'week';

        const result = await db.query(query, [masterId, dateFrom, periodUnit]);
        return result.rows;
    }

    async generatePerformanceReport(masterId, period = '30days') {
        try {
            const [
                businessMetrics,
                revenueAnalytics,
                clientSegmentation
            ] = await Promise.all([
                this.getBusinessMetrics(masterId, period),
                this.getRevenueAnalytics(masterId, period),
                this.getClientSegmentation(masterId)
            ]);

            return {
                metrics: businessMetrics,
                revenue: revenueAnalytics,
                clients: clientSegmentation,
                generated_at: new Date()
            };
        } catch (error) {
            loggingService.logError(error, { 
                context: 'performance_report',
                masterId,
                period 
            });
            throw error;
        }
    }

    async getClientSegmentation(masterId) {
        const query = `
            WITH client_stats AS (
                SELECT 
                    client_id,
                    COUNT(*) as visit_count,
                    SUM(price) as total_spent,
                    MAX(created_at) as last_visit
                FROM appointments
                WHERE 
                    master_id = $1
                    AND status = 'completed'
                GROUP BY client_id
            )
            SELECT 
                CASE 
                    WHEN visit_count >= 10 AND total_spent >= 10000 THEN 'vip'
                    WHEN visit_count >= 5 OR total_spent >= 5000 THEN 'regular'
                    WHEN last_visit < NOW() - INTERVAL '6 months' THEN 'inactive'
                    ELSE 'new'
                END as segment,
                COUNT(*) as client_count,
                AVG(total_spent) as average_spent,
                AVG(visit_count) as average_visits
            FROM client_stats
            GROUP BY 
                CASE 
                    WHEN visit_count >= 10 AND total_spent >= 10000 THEN 'vip'
                    WHEN visit_count >= 5 OR total_spent >= 5000 THEN 'regular'
                    WHEN last_visit < NOW() - INTERVAL '6 months' THEN 'inactive'
                    ELSE 'new'
                END
        `;

        const result = await db.query(query, [masterId]);
        return result.rows;
    }
}

module.exports = new AnalyticsService(); 