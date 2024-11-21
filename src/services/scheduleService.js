const db = require('../database/db');
const moment = require('moment');

class ScheduleService {
    async createTimeSlots(masterId, date, startTime, endTime, interval) {
        const slots = [];
        let currentTime = moment(`${date} ${startTime}`);
        const endDateTime = moment(`${date} ${endTime}`);

        while (currentTime.isBefore(endDateTime)) {
            slots.push({
                masterId,
                startTime: currentTime.format('YYYY-MM-DD HH:mm:ss'),
                endTime: currentTime.add(interval, 'minutes').format('YYYY-MM-DD HH:mm:ss')
            });
        }

        const query = `
            INSERT INTO time_slots (master_id, start_time, end_time)
            VALUES ${slots.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',')}
            RETURNING id
        `;

        const values = slots.flatMap(slot => [
            slot.masterId,
            slot.startTime,
            slot.endTime
        ]);

        return db.query(query, values);
    }

    async getAvailableSlots(masterId, date) {
        const query = `
            SELECT * FROM time_slots
            WHERE master_id = $1 
            AND DATE(start_time) = $2
            AND is_available = true
            ORDER BY start_time
        `;
        const result = await db.query(query, [masterId, date]);
        return result.rows;
    }
}

module.exports = new ScheduleService(); 