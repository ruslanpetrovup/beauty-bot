const appointmentService = require('../services/appointmentService');
const TestUtils = require('../utils/testUtils');
const db = require('../database/db');

describe('AppointmentService', () => {
    let testMaster;
    let testClient;

    beforeAll(async () => {
        testMaster = await TestUtils.createTestMaster();
        testClient = await TestUtils.createTestClient();
    });

    afterAll(async () => {
        await TestUtils.cleanupTestData();
    });

    describe('createAppointment', () => {
        it('should create a new appointment', async () => {
            const appointmentData = {
                masterId: testMaster.id,
                clientId: testClient.id,
                serviceId: 1,
                startTime: '2024-04-01 10:00:00',
                duration: 60
            };

            const appointment = await appointmentService.createAppointment(
                appointmentData
            );

            expect(appointment).toBeDefined();
            expect(appointment.master_id).toBe(testMaster.id);
            expect(appointment.client_id).toBe(testClient.id);
            expect(appointment.status).toBe('pending');
        });

        it('should throw error for invalid time slot', async () => {
            const appointmentData = {
                masterId: testMaster.id,
                clientId: testClient.id,
                serviceId: 1,
                startTime: '2024-04-01 03:00:00', // Нерабочее время
                duration: 60
            };

            await expect(
                appointmentService.createAppointment(appointmentData)
            ).rejects.toThrow('Invalid time slot');
        });
    });

    describe('getAvailableSlots', () => {
        it('should return available time slots', async () => {
            const date = '2024-04-01';
            const slots = await appointmentService.getAvailableSlots(
                testMaster.id,
                date
            );

            expect(Array.isArray(slots)).toBe(true);
            expect(slots.length).toBeGreaterThan(0);
            slots.forEach(slot => {
                expect(slot).toMatch(/^\d{2}:\d{2}$/);
            });
        });
    });

    describe('cancelAppointment', () => {
        it('should cancel existing appointment', async () => {
            const appointment = await TestUtils.createTestAppointment(
                testMaster.id,
                testClient.id
            );

            const cancelled = await appointmentService.cancelAppointment(
                appointment.id,
                'client_request'
            );

            expect(cancelled.status).toBe('cancelled');
            expect(cancelled.cancel_reason).toBe('client_request');
        });

        it('should throw error for non-existent appointment', async () => {
            await expect(
                appointmentService.cancelAppointment(99999, 'test')
            ).rejects.toThrow('Appointment not found');
        });
    });
}); 