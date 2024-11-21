const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../database/db');

class TestUtils {
    static async createTestMaster(overrides = {}) {
        const defaultMaster = {
            name: `Test Master ${uuidv4().slice(0, 8)}`,
            phone: `+380${Math.floor(Math.random() * 1000000000)}`,
            email: `test${uuidv4().slice(0, 8)}@example.com`,
            salon_name: 'Test Salon',
            address: 'Test Address',
            working_hours: {
                mon: { start: '09:00', end: '18:00' },
                tue: { start: '09:00', end: '18:00' },
                wed: { start: '09:00', end: '18:00' },
                thu: { start: '09:00', end: '18:00' },
                fri: { start: '09:00', end: '18:00' }
            }
        };

        const masterData = { ...defaultMaster, ...overrides };
        
        const query = `
            INSERT INTO masters (
                name,
                phone,
                email,
                salon_name,
                address,
                working_hours,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;

        const result = await db.query(query, [
            masterData.name,
            masterData.phone,
            masterData.email,
            masterData.salon_name,
            masterData.address,
            masterData.working_hours
        ]);

        return result.rows[0];
    }

    static async createTestClient(overrides = {}) {
        const defaultClient = {
            name: `Test Client ${uuidv4().slice(0, 8)}`,
            phone: `+380${Math.floor(Math.random() * 1000000000)}`,
            email: `test${uuidv4().slice(0, 8)}@example.com`
        };

        const clientData = { ...defaultClient, ...overrides };
        
        const query = `
            INSERT INTO clients (
                name,
                phone,
                email,
                created_at
            )
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `;

        const result = await db.query(query, [
            clientData.name,
            clientData.phone,
            clientData.email
        ]);

        return result.rows[0];
    }

    static async createTestAppointment(masterId, clientId, overrides = {}) {
        const defaultAppointment = {
            service_id: 1,
            start_time: moment().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
            duration: 60,
            status: 'pending',
            price: 500
        };

        const appointmentData = { ...defaultAppointment, ...overrides };
        
        const query = `
            INSERT INTO appointments (
                master_id,
                client_id,
                service_id,
                start_time,
                duration,
                status,
                price,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
        `;

        const result = await db.query(query, [
            masterId,
            clientId,
            appointmentData.service_id,
            appointmentData.start_time,
            appointmentData.duration,
            appointmentData.status,
            appointmentData.price
        ]);

        return result.rows[0];
    }

    static async cleanupTestData() {
        const queries = [
            'DELETE FROM appointments WHERE master_id IN (SELECT id FROM masters WHERE name LIKE \'Test Master%\')',
            'DELETE FROM clients WHERE name LIKE \'Test Client%\'',
            'DELETE FROM masters WHERE name LIKE \'Test Master%\''
        ];

        for (const query of queries) {
            await db.query(query);
        }
    }

    static mockTelegramContext() {
        return {
            reply: jest.fn(),
            replyWithMarkdown: jest.fn(),
            editMessageText: jest.fn(),
            editMessageReplyMarkup: jest.fn(),
            answerCbQuery: jest.fn(),
            session: {},
            from: {
                id: 123456789,
                first_name: 'Test',
                last_name: 'User'
            },
            message: {
                message_id: 1,
                text: 'test message'
            }
        };
    }

    static async waitForAsync(callback, timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await callback()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Async operation timeout');
    }
}

module.exports = TestUtils; 