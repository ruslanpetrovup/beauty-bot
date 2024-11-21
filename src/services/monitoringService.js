const prometheus = require('prom-client');
const os = require('os');
const db = require('../database/db');
const loggingService = require('./loggingService');

class MonitoringService {
    constructor() {
        // Инициализация Prometheus метрик
        prometheus.collectDefaultMetrics();

        this.metrics = {
            requestDuration: new prometheus.Histogram({
                name: 'bot_request_duration_seconds',
                help: 'Duration of bot requests',
                labelNames: ['command', 'status']
            }),

            dbQueryDuration: new prometheus.Histogram({
                name: 'db_query_duration_seconds',
                help: 'Duration of database queries',
                labelNames: ['query_type']
            }),

            activeUsers: new prometheus.Gauge({
                name: 'bot_active_users',
                help: 'Number of active users'
            }),

            appointmentsTotal: new prometheus.Counter({
                name: 'appointments_total',
                help: 'Total number of appointments'
            }),

            errorRate: new prometheus.Counter({
                name: 'bot_errors_total',
                help: 'Total number of errors',
                labelNames: ['type']
            }),

            cacheHitRate: new prometheus.Counter({
                name: 'cache_operations_total',
                help: 'Cache operations',
                labelNames: ['operation', 'status']
            })
        };

        // Запуск периодических проверок
        this.startPeriodicChecks();
    }

    async measureRequestDuration(command, callback) {
        const end = this.metrics.requestDuration.startTimer();
        try {
            const result = await callback();
            end({ command, status: 'success' });
            return result;
        } catch (error) {
            end({ command, status: 'error' });
            throw error;
        }
    }

    async measureDbQuery(queryType, callback) {
        const end = this.metrics.dbQueryDuration.startTimer();
        try {
            const result = await callback();
            end({ query_type: queryType });
            return result;
        } catch (error) {
            this.metrics.errorRate.inc({ type: 'database' });
            throw error;
        }
    }

    recordCacheOperation(operation, hit) {
        this.metrics.cacheHitRate.inc({
            operation,
            status: hit ? 'hit' : 'miss'
        });
    }

    async checkSystemHealth() {
        const metrics = {
            cpu: os.loadavg()[0],
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                usage: (1 - os.freemem() / os.totalmem()) * 100
            },
            uptime: os.uptime()
        };

        try {
            // Проверка соединения с БД
            const dbCheck = await this.checkDatabase();
            metrics.database = dbCheck;

            // Проверка Redis если используется
            const redisCheck = await this.checkRedis();
            metrics.redis = redisCheck;

            return metrics;
        } catch (error) {
            loggingService.logError(error, { context: 'health_check' });
            return { ...metrics, error: error.message };
        }
    }

    async getPerformanceMetrics() {
        try {
            const query = `
                SELECT 
                    AVG(duration) as avg_duration,
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
                FROM request_logs
                WHERE created_at >= NOW() - INTERVAL '1 hour'
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            loggingService.logError(error, { context: 'performance_metrics' });
            throw error;
        }
    }

    async checkDatabase() {
        try {
            const startTime = Date.now();
            await db.query('SELECT 1');
            return {
                status: 'healthy',
                responseTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async checkRedis() {
        if (!global.redis) return { status: 'not_configured' };

        try {
            const startTime = Date.now();
            await global.redis.ping();
            return {
                status: 'healthy',
                responseTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    startPeriodicChecks() {
        setInterval(async () => {
            try {
                const health = await this.checkSystemHealth();
                
                if (health.memory.usage > 90) {
                    loggingService.logEvent('high_memory_usage', {
                        usage: health.memory.usage,
                        free: health.memory.free
                    });
                }

                if (health.cpu > 80) {
                    loggingService.logEvent('high_cpu_usage', {
                        cpu: health.cpu
                    });
                }

                if (health.database.status === 'unhealthy') {
                    loggingService.logEvent('database_health_check_failed', {
                        error: health.database.error
                    });
                }
            } catch (error) {
                loggingService.logError(error, { context: 'periodic_health_check' });
            }
        }, 60000); // Каждую минуту
    }
}

module.exports = new MonitoringService(); 