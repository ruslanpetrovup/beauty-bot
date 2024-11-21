const db = require('../database/db');
const moment = require('moment');

class AppointmentService {
    async createAppointment(clientId, masterId, serviceId, timeSlotId, comment = null) {
        const query = `
            INSERT INTO appointments 
            (client_id, master_id, service_id, time_slot_id, comment, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `;
        
        const result = await db.query(query, [
            clientId, masterId, serviceId, timeSlotId, comment
        ]);

        // Помечаем временной слот как занятый
        await db.query(
            'UPDATE time_slots SET is_available = false WHERE id = $1',
            [timeSlotId]
        );

        return result.rows[0];
    }

    async getAvailableTimeSlots(masterId, date) {
        const query = `
            SELECT ts.*, s.duration
            FROM time_slots ts
            LEFT JOIN appointments a ON ts.id = a.time_slot_id
            LEFT JOIN services s ON a.service_id = s.id
            WHERE ts.master_id = $1 
            AND DATE(ts.start_time) = $2
            AND ts.is_available = true
            AND a.id IS NULL
            ORDER BY ts.start_time
        `;
        
        const result = await db.query(query, [masterId, date]);
        return result.rows;
    }

    async confirmAppointment(appointmentId) {
        const query = `
            UPDATE appointments 
            SET status = 'confirmed'
            WHERE id = $1
            RETURNING *
        `;
        return db.query(query, [appointmentId]);
    }

    async cancelAppointment(appointmentId) {
        const query = `
            UPDATE appointments 
            SET status = 'cancelled'
            WHERE id = $1
            RETURNING time_slot_id
        `;
        
        const result = await db.query(query, [appointmentId]);
        
        // Освобождаем временной слот
        if (result.rows[0]) {
            await db.query(
                'UPDATE time_slots SET is_available = true WHERE id = $1',
                [result.rows[0].time_slot_id]
            );
        }
        
        return result.rows[0];
    }
}

module.exports = new AppointmentService(); 