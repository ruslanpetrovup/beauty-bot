const db = require('../database/db');

class ReviewService {
    async createReview(appointmentId, rating, comment = null) {
        const query = `
            INSERT INTO reviews (appointment_id, rating, comment)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        return db.query(query, [appointmentId, rating, comment]);
    }

    async getMasterReviews(masterId) {
        const query = `
            SELECT r.*, u.name as client_name, a.service_id
            FROM reviews r
            JOIN appointments a ON r.appointment_id = a.id
            JOIN users u ON a.client_id = u.id
            WHERE a.master_id = $1
            ORDER BY r.created_at DESC
        `;
        return db.query(query, [masterId]);
    }

    async getAverageRating(masterId) {
        const query = `
            SELECT AVG(r.rating) as average_rating
            FROM reviews r
            JOIN appointments a ON r.appointment_id = a.id
            WHERE a.master_id = $1
        `;
        const result = await db.query(query, [masterId]);
        return result.rows[0]?.average_rating || 0;
    }
}

module.exports = new ReviewService(); 