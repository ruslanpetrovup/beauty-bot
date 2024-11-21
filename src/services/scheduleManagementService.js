const db = require('../database/db');
const moment = require('moment');

class ScheduleManagementService {
    async createScheduleTemplate(masterId, data) {
        const query = `
            INSERT INTO schedule_templates (
                master_id,
                day_of_week,
                start_time,
                end_time,
                break_start,
                break_end,
                slot_duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        return db.query(query, [
            masterId,
            data.dayOfWeek,
            data.startTime,
            data.endTime,
            data.breakStart,
            data.breakEnd,
            data.slotDuration
        ]);
    }

    async generateTimeSlots(masterId, dateFrom, dateTo) {
        // Получаем шаблон расписания
        const templates = await this.getScheduleTemplates(masterId);
        const slots = [];

        let currentDate = moment(dateFrom);
        const endDate = moment(dateTo);

        while (currentDate.isSameOrBefore(endDate)) {
            const template = templates.find(t => 
                t.day_of_week === currentDate.day()
            );

            if (template) {
                const daySlots = await this.generateDaySlots(
                    masterId,
                    currentDate,
                    template
                );
                slots.push(...daySlots);
            }

            currentDate.add(1, 'day');
        }

        // Сохраняем сгенерированные слоты
        if (slots.length > 0) {
            await this.saveTimeSlots(slots);
        }

        return slots;
    }

    async generateDaySlots(masterId, date, template) {
        const slots = [];
        let currentTime = moment(date)
            .hours(template.start_time.split(':')[0])
            .minutes(template.start_time.split(':')[1]);
        
        const endTime = moment(date)
            .hours(template.end_time.split(':')[0])
            .minutes(template.end_time.split(':')[1]);

        while (currentTime.isBefore(endTime)) {
            // Проверяем, не попадает ли время в перерыв
            const isBreakTime = this.isTimeInBreak(
                currentTime,
                template.break_start,
                template.break_end
            );

            if (!isBreakTime) {
                slots.push({
                    masterId,
                    startTime: currentTime.format('YYYY-MM-DD HH:mm:ss'),
                    endTime: currentTime
                        .clone()
                        .add(template.slot_duration, 'minutes')
                        .format('YYYY-MM-DD HH:mm:ss')
                });
            }

            currentTime.add(template.slot_duration, 'minutes');
        }

        return slots;
    }

    async saveTimeSlots(slots) {
        const query = `
            INSERT INTO time_slots (master_id, start_time, end_time)
            VALUES ${slots.map((_, idx) => 
                `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
            ).join(',')}
        `;

        const values = slots.flatMap(slot => [
            slot.masterId,
            slot.startTime,
            slot.endTime
        ]);

        return db.query(query, values);
    }

    async getScheduleTemplates(masterId) {
        const query = `
            SELECT * FROM schedule_templates
            WHERE master_id = $1
        `;
        const result = await db.query(query, [masterId]);
        return result.rows;
    }

    async markDayOff(masterId, date) {
        const query = `
            INSERT INTO master_days_off (master_id, date)
            VALUES ($1, $2)
            RETURNING *
        `;
        return db.query(query, [masterId, date]);
    }

    isTimeInBreak(currentTime, breakStart, breakEnd) {
        if (!breakStart || !breakEnd) return false;

        const timeStr = currentTime.format('HH:mm');
        return timeStr >= breakStart && timeStr < breakEnd;
    }
}

module.exports = new ScheduleManagementService(); 