const db = require('../database/db');
const moment = require('moment');

class ClientService {
    async getFavoriteMasters(clientId) {
        const query = `
            SELECT DISTINCT 
                m.id,
                u.name as master_name,
                m.salon_name,
                m.address,
                COALESCE(m.average_rating, 0) as rating,
                COUNT(DISTINCT a.id) as visit_count,
                MAX(a.start_time) as last_visit
            FROM appointments a
            JOIN masters m ON a.master_id = m.id
            JOIN users u ON m.user_id = u.id
            WHERE a.client_id = $1
            GROUP BY m.id, u.name, m.salon_name, m.address, m.average_rating
            ORDER BY visit_count DESC, last_visit DESC
        `;
        
        return db.query(query, [clientId]);
    }

    async getUpcomingAppointments(clientId) {
        const query = `
            SELECT 
                a.*,
                u.name as master_name,
                m.salon_name,
                m.address,
                s.name as service_name,
                s.price
            FROM appointments a
            JOIN masters m ON a.master_id = m.id
            JOIN users u ON m.user_id = u.id
            JOIN services s ON a.service_id = s.id
            WHERE 
                a.client_id = $1 
                AND a.start_time > NOW()
                AND a.status NOT IN ('cancelled', 'completed')
            ORDER BY a.start_time ASC
        `;
        
        return db.query(query, [clientId]);
    }

    async removeMaster(clientId, masterId) {
        const query = `
            INSERT INTO removed_masters (client_id, master_id)
            VALUES ($1, $2)
            ON CONFLICT (client_id, master_id) DO NOTHING
            RETURNING *
        `;
        
        return db.query(query, [clientId, masterId]);
    }

    async restoreMaster(clientId, masterId) {
        const query = `
            DELETE FROM removed_masters
            WHERE client_id = $1 AND master_id = $2
            RETURNING *
        `;
        
        return db.query(query, [clientId, masterId]);
    }

    async getClientPreferences(clientId) {
        const query = `
            SELECT 
                preferred_days,
                preferred_time,
                notification_settings,
                preferred_payment_method
            FROM client_preferences
            WHERE client_id = $1
        `;
        
        const result = await db.query(query, [clientId]);
        return result.rows[0];
    }

    async updateClientPreferences(clientId, preferences) {
        const query = `
            INSERT INTO client_preferences (
                client_id,
                preferred_days,
                preferred_time,
                notification_settings,
                preferred_payment_method
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (client_id) DO UPDATE
            SET 
                preferred_days = EXCLUDED.preferred_days,
                preferred_time = EXCLUDED.preferred_time,
                notification_settings = EXCLUDED.notification_settings,
                preferred_payment_method = EXCLUDED.preferred_payment_method
            RETURNING *
        `;
        
        return db.query(query, [
            clientId,
            preferences.preferred_days,
            preferences.preferred_time,
            preferences.notification_settings,
            preferences.preferred_payment_method
        ]);
    }
}

module.exports = new ClientService(); 