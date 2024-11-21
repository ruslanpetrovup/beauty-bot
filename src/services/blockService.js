const db = require('../database/db');

class BlockService {
    async blockClient(masterId, clientId, reason = null) {
        const query = `
            INSERT INTO blocked_clients (master_id, client_id, reason)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        return db.query(query, [masterId, clientId, reason]);
    }

    async unblockClient(masterId, clientId) {
        const query = `
            DELETE FROM blocked_clients
            WHERE master_id = $1 AND client_id = $2
        `;
        return db.query(query, [masterId, clientId]);
    }

    async isClientBlocked(masterId, clientId) {
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM blocked_clients
                WHERE master_id = $1 AND client_id = $2
            ) as is_blocked
        `;
        const result = await db.query(query, [masterId, clientId]);
        return result.rows[0].is_blocked;
    }

    async getBlockedClients(masterId) {
        const query = `
            SELECT 
                bc.*,
                u.name as client_name,
                u.phone as client_phone
            FROM blocked_clients bc
            JOIN users u ON bc.client_id = u.id
            WHERE bc.master_id = $1
            ORDER BY bc.created_at DESC
        `;
        return db.query(query, [masterId]);
    }
}

module.exports = new BlockService(); 