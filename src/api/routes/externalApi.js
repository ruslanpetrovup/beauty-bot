const express = require('express');
const router = express.Router();
const securityService = require('../../services/securityService');
const loggingService = require('../../services/loggingService');
const appointmentService = require('../../services/appointmentService');
const masterService = require('../../services/masterService');

// Middleware для проверки API ключа
const validateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    try {
        const master = await masterService.validateApiKey(apiKey);
        req.masterId = master.id;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid API key' });
    }
};

// Middleware для логирования запросов
const logApiRequest = async (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        loggingService.logEvent('api_request', {
            method: req.method,
            path: req.path,
            params: req.params,
            query: req.query,
            duration,
            status: res.statusCode,
            masterId: req.masterId
        });
    });

    next();
};

router.use(validateApiKey);
router.use(logApiRequest);
router.use(securityService.getRateLimiter());

// Получение свободных слотов
router.get('/slots', async (req, res) => {
    try {
        const { date, serviceId } = req.query;
        const slots = await appointmentService.getAvailableSlots(
            req.masterId,
            date,
            serviceId
        );
        res.json(slots);
    } catch (error) {
        loggingService.logError(error, { 
            context: 'api_slots',
            masterId: req.masterId 
        });
        res.status(500).json({ error: error.message });
    }
});

// Создание записи
router.post('/appointments', async (req, res) => {
    try {
        const appointment = await appointmentService.createAppointment({
            ...req.body,
            masterId: req.masterId
        });
        res.json(appointment);
    } catch (error) {
        loggingService.logError(error, { 
            context: 'api_create_appointment',
            masterId: req.masterId 
        });
        res.status(500).json({ error: error.message });
    }
});

// Получение статистики
router.get('/statistics', async (req, res) => {
    try {
        const { period = '30days' } = req.query;
        const stats = await masterService.getMasterStatistics(
            req.masterId,
            period
        );
        res.json(stats);
    } catch (error) {
        loggingService.logError(error, { 
            context: 'api_statistics',
            masterId: req.masterId 
        });
        res.status(500).json({ error: error.message });
    }
});

// Webhook для внешних событий
router.post('/webhook', async (req, res) => {
    try {
        const { event, data } = req.body;
        
        await loggingService.logEvent('webhook', {
            event,
            data,
            masterId: req.masterId
        });

        // Обработка различных типов событий
        switch (event) {
            case 'payment_completed':
                await appointmentService.handlePaymentWebhook(data);
                break;
            case 'client_feedback':
                await masterService.handleFeedbackWebhook(data);
                break;
            default:
                throw new Error('Unknown event type');
        }

        res.json({ success: true });
    } catch (error) {
        loggingService.logError(error, { 
            context: 'api_webhook',
            masterId: req.masterId 
        });
        res.status(500).json({ error: error.message });
    }
});

// Получение информации о мастере
router.get('/master-info', async (req, res) => {
    try {
        const info = await masterService.getMasterPublicInfo(req.masterId);
        res.json(info);
    } catch (error) {
        loggingService.logError(error, { 
            context: 'api_master_info',
            masterId: req.masterId 
        });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 