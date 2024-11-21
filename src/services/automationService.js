const db = require('../database/db');
const moment = require('moment');
const notificationService = require('./notificationService');
const analyticsService = require('./analyticsService');
const loggingService = require('./loggingService');

class AutomationService {
    constructor() {
        this.rules = {
            reminderBeforeAppointment: 24, // часы
            followUpAfterAppointment: 48, // часы
            inactiveClientPeriod: 30, // дни
            lowInventoryThreshold: 20, // процент
            revenueAlertThreshold: -15 // процент
        };
    }

    async processAutomatedTasks() {
        try {
            await Promise.all([
                this.sendAppointmentReminders(),
                this.sendFollowUpMessages(),
                this.processInactiveClients(),
                this.checkInventoryLevels(),
                this.analyzeRevenueChanges()
            ]);
        } catch (error) {
            loggingService.logError(error, { context: 'automated_tasks' });
        }
    }

    async sendAppointmentReminders() {
        const query = `
            SELECT 
                a.id,
                a.client_id,
                a.start_time,
                a.service_name,
                m.name as master_name,
                m.salon_name,
                m.address
            FROM appointments a
            JOIN masters m ON a.master_id = m.id
            WHERE 
                a.status = 'confirmed'
                AND a.start_time BETWEEN 
                    NOW() + INTERVAL '${this.rules.reminderBeforeAppointment - 1} hours'
                    AND NOW() + INTERVAL '${this.rules.reminderBeforeAppointment} hours'
                AND a.reminder_sent = false
        `;

        const appointments = await db.query(query);
        
        for (const apt of appointments.rows) {
            await notificationService.sendAppointmentReminder(apt);
            await this.markReminderSent(apt.id);
        }
    }

    async sendFollowUpMessages() {
        const query = `
            SELECT 
                a.id,
                a.client_id,
                a.master_id,
                a.service_name,
                c.name as client_name
            FROM appointments a
            JOIN clients c ON a.client_id = c.id
            WHERE 
                a.status = 'completed'
                AND a.completed_at BETWEEN 
                    NOW() - INTERVAL '${this.rules.followUpAfterAppointment} hours'
                    AND NOW() - INTERVAL '${this.rules.followUpAfterAppointment - 1} hours'
                AND a.follow_up_sent = false
        `;

        const appointments = await db.query(query);
        
        for (const apt of appointments.rows) {
            await notificationService.sendFollowUpMessage(apt);
            await this.markFollowUpSent(apt.id);
        }
    }

    async processInactiveClients() {
        const query = `
            SELECT 
                c.id,
                c.name,
                c.phone,
                MAX(a.created_at) as last_visit
            FROM clients c
            LEFT JOIN appointments a ON c.id = a.client_id
            GROUP BY c.id, c.name, c.phone
            HAVING 
                MAX(a.created_at) < NOW() - INTERVAL '${this.rules.inactiveClientPeriod} days'
                OR MAX(a.created_at) IS NULL
        `;

        const inactiveClients = await db.query(query);
        
        for (const client of inactiveClients.rows) {
            await notificationService.sendReactivationMessage(client);
        }
    }

    async checkInventoryLevels() {
        const query = `
            SELECT 
                i.id,
                i.name,
                i.current_quantity,
                i.minimum_quantity
            FROM inventory i
            WHERE 
                (i.current_quantity::float / i.minimum_quantity::float) * 100 <= $1
        `;

        const lowInventory = await db.query(query, [this.rules.lowInventoryThreshold]);
        
        if (lowInventory.rows.length > 0) {
            await notificationService.sendLowInventoryAlert(lowInventory.rows);
        }
    }

    async analyzeRevenueChanges() {
        const currentRevenue = await analyticsService.getRevenueAnalytics('7days');
        const previousRevenue = await analyticsService.getRevenueAnalytics('7days', -7);

        const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;

        if (change <= this.rules.revenueAlertThreshold) {
            await notificationService.sendRevenueAlert({
                change,
                currentRevenue,
                previousRevenue
            });
        }
    }
}

module.exports = new AutomationService(); 