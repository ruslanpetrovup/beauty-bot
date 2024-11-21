const { google } = require('googleapis');
const ical = require('ical-generator');
const db = require('../database/db');
const moment = require('moment');

class CalendarService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URL
        );
    }

    async generateAuthUrl(masterId) {
        const state = Buffer.from(JSON.stringify({ masterId })).toString('base64');
        
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
            state
        });
    }

    async handleGoogleCallback(code, state) {
        const { masterId } = JSON.parse(Buffer.from(state, 'base64').toString());
        
        const { tokens } = await this.oauth2Client.getToken(code);
        await this.saveCalendarTokens(masterId, tokens);
        
        return tokens;
    }

    async createGoogleCalendarEvent(appointmentId) {
        const appointment = await this.getAppointmentDetails(appointmentId);
        const tokens = await this.getCalendarTokens(appointment.master_id);

        this.oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const event = {
            summary: `Запись: ${appointment.service_name}`,
            description: `Клиент: ${appointment.client_name}\nТелефон: ${appointment.client_phone}`,
            start: {
                dateTime: appointment.start_time,
                timeZone: 'Europe/Kiev',
            },
            end: {
                dateTime: moment(appointment.start_time)
                    .add(appointment.duration, 'minutes')
                    .format(),
                timeZone: 'Europe/Kiev',
            }
        };

        const result = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        await this.saveCalendarEventId(appointmentId, result.data.id);
        return result.data;
    }

    async generateICalFile(masterId, dateFrom, dateTo) {
        const appointments = await this.getMasterAppointments(masterId, dateFrom, dateTo);
        const calendar = ical({ name: 'Расписание' });

        appointments.forEach(apt => {
            calendar.createEvent({
                start: moment(apt.start_time).toDate(),
                end: moment(apt.start_time).add(apt.duration, 'minutes').toDate(),
                summary: `Клиент: ${apt.client_name}`,
                description: `Услуга: ${apt.service_name}\nТелефон: ${apt.client_phone}`,
                location: apt.salon_address
            });
        });

        return calendar.toString();
    }

    async saveCalendarTokens(masterId, tokens) {
        const query = `
            INSERT INTO calendar_tokens (master_id, tokens)
            VALUES ($1, $2)
            ON CONFLICT (master_id) 
            DO UPDATE SET tokens = $2
        `;
        
        return db.query(query, [masterId, tokens]);
    }

    async getCalendarTokens(masterId) {
        const query = `
            SELECT tokens FROM calendar_tokens
            WHERE master_id = $1
        `;
        
        const result = await db.query(query, [masterId]);
        return result.rows[0]?.tokens;
    }

    async saveCalendarEventId(appointmentId, eventId) {
        const query = `
            UPDATE appointments
            SET calendar_event_id = $2
            WHERE id = $1
        `;
        
        return db.query(query, [appointmentId, eventId]);
    }

    async getAppointmentDetails(appointmentId) {
        const query = `
            SELECT 
                a.*,
                u.name as client_name,
                u.phone as client_phone,
                s.name as service_name,
                s.duration,
                m.salon_address
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            JOIN services s ON a.service_id = s.id
            JOIN masters m ON a.master_id = m.id
            WHERE a.id = $1
        `;
        
        const result = await db.query(query, [appointmentId]);
        return result.rows[0];
    }
}

module.exports = new CalendarService(); 