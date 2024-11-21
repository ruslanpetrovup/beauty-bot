const db = require('../database/db');
const moment = require('moment');

class BusinessManagementService {
    async addEmployee(masterId, userData) {
        const query = `
            WITH new_user AS (
                INSERT INTO users (name, phone, telegram_id, role)
                VALUES ($1, $2, $3, 'employee')
                RETURNING id
            )
            INSERT INTO employees (
                user_id, 
                master_id, 
                position, 
                salary_type,
                salary_amount,
                commission_percentage
            )
            SELECT 
                new_user.id,
                $4,
                $5,
                $6,
                $7,
                $8
            FROM new_user
            RETURNING id
        `;

        return db.query(query, [
            userData.name,
            userData.phone,
            userData.telegram_id,
            masterId,
            userData.position,
            userData.salary_type,
            userData.salary_amount,
            userData.commission_percentage
        ]);
    }

    async getFinancialReport(masterId, period) {
        const dateFrom = moment().subtract(1, period).startOf(period);
        const dateTo = moment().endOf(period);

        const query = `
            WITH financial_data AS (
                SELECT 
                    DATE_TRUNC($3, a.start_time) as period,
                    COUNT(DISTINCT a.id) as total_appointments,
                    SUM(s.price) as total_revenue,
                    SUM(CASE 
                        WHEN e.salary_type = 'commission' 
                        THEN s.price * (e.commission_percentage / 100)
                        ELSE e.salary_amount
                    END) as total_expenses,
                    COUNT(DISTINCT a.client_id) as unique_clients
                FROM appointments a
                JOIN services s ON a.service_id = s.id
                LEFT JOIN employees e ON a.employee_id = e.id
                WHERE 
                    a.master_id = $1
                    AND a.start_time BETWEEN $4 AND $5
                    AND a.status = 'completed'
                GROUP BY DATE_TRUNC($3, a.start_time)
            )
            SELECT 
                period,
                total_appointments,
                total_revenue,
                total_expenses,
                (total_revenue - total_expenses) as net_profit,
                unique_clients,
                CASE 
                    WHEN total_appointments > 0 
                    THEN total_revenue / total_appointments 
                    ELSE 0 
                END as average_check
            FROM financial_data
            ORDER BY period DESC
        `;

        return db.query(query, [
            masterId,
            period,
            period === 'year' ? 'month' : 'day',
            dateFrom,
            dateTo
        ]);
    }

    async getInventoryReport(masterId) {
        const query = `
            SELECT 
                i.name,
                i.current_quantity,
                i.minimum_quantity,
                i.unit,
                i.last_purchase_price,
                i.last_purchase_date,
                CASE 
                    WHEN i.current_quantity <= i.minimum_quantity THEN true 
                    ELSE false 
                END as needs_reorder
            FROM inventory i
            WHERE i.master_id = $1
            ORDER BY needs_reorder DESC, name ASC
        `;

        return db.query(query, [masterId]);
    }

    async updateInventory(masterId, items) {
        const query = `
            INSERT INTO inventory_transactions (
                inventory_id,
                transaction_type,
                quantity,
                price_per_unit,
                total_price,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const updates = [];
        for (const item of items) {
            updates.push(
                db.query(query, [
                    item.inventory_id,
                    item.type,
                    item.quantity,
                    item.price_per_unit,
                    item.quantity * item.price_per_unit,
                    item.notes
                ])
            );
        }

        return Promise.all(updates);
    }

    async getEmployeePerformance(masterId, employeeId, period = '30days') {
        const dateFrom = moment().subtract(
            period === '30days' ? 30 :
            period === '90days' ? 90 :
            365, 'days'
        ).format('YYYY-MM-DD');

        const query = `
            SELECT 
                e.id,
                u.name,
                COUNT(a.id) as total_appointments,
                SUM(s.price) as total_revenue,
                AVG(r.rating) as average_rating,
                COUNT(DISTINCT a.client_id) as unique_clients,
                SUM(CASE 
                    WHEN e.salary_type = 'commission' 
                    THEN s.price * (e.commission_percentage / 100)
                    ELSE e.salary_amount
                END) as total_earnings
            FROM employees e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN appointments a ON a.employee_id = e.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN reviews r ON r.appointment_id = a.id
            WHERE 
                e.master_id = $1
                AND ($2 IS NULL OR e.id = $2)
                AND a.start_time >= $3
                AND a.status = 'completed'
            GROUP BY e.id, u.name
        `;

        return db.query(query, [masterId, employeeId, dateFrom]);
    }
}

module.exports = new BusinessManagementService(); 