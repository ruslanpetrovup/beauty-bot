const db = require('../database/db');

class ServiceService {
    async createService({ masterId, name, price, duration }) {
        try {
            const client = await db.pool.connect();
            
            try {
                await client.query('BEGIN');

                // Сначала создаем услугу
                const createServiceQuery = `
                    INSERT INTO services (name, description)
                    VALUES ($1, $2)
                    RETURNING id
                `;
                const serviceResult = await client.query(createServiceQuery, [name, '']);
                const serviceId = serviceResult.rows[0].id;

                // Получаем master_id из таблицы masters
                const getMasterIdQuery = `
                    SELECT id FROM masters 
                    WHERE user_id = (
                        SELECT id FROM users WHERE telegram_id = $1
                    )
                `;
                const masterResult = await client.query(getMasterIdQuery, [masterId]);
                const realMasterId = masterResult.rows[0].id;

                // Создаем связь мастера с услугой
                const createMasterServiceQuery = `
                    INSERT INTO master_services (master_id, service_id, price, duration)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                `;
                const masterServiceResult = await client.query(
                    createMasterServiceQuery,
                    [realMasterId, serviceId, price, duration]
                );

                await client.query('COMMIT');
                return masterServiceResult.rows[0];
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error in createService:', error);
            throw error;
        }
    }

    async getServicesByMaster(masterId) {
        try {
            const query = `
                SELECT 
                    s.id as service_id,
                    s.name,
                    ms.price,
                    ms.duration
                FROM services s
                JOIN master_services ms ON s.id = ms.service_id
                JOIN masters m ON ms.master_id = m.id
                JOIN users u ON m.user_id = u.id
                WHERE u.telegram_id = $1 
                AND s.is_active = true 
                AND ms.is_active = true
                ORDER BY s.name
            `;
            const result = await db.query(query, [masterId]);
            return result.rows;
        } catch (error) {
            console.error('Error in getServicesByMaster:', error);
            throw error;
        }
    }

    async updateService(serviceId, masterId, updates) {
        try {
            const client = await db.pool.connect();
            
            try {
                await client.query('BEGIN');

                const getMasterServiceQuery = `
                    SELECT ms.id 
                    FROM master_services ms
                    JOIN masters m ON ms.master_id = m.id
                    JOIN users u ON m.user_id = u.id
                    WHERE u.telegram_id = $1 AND ms.service_id = $2
                `;
                const masterServiceResult = await client.query(getMasterServiceQuery, [masterId, serviceId]);
                const masterServiceId = masterServiceResult.rows[0].id;

                if (updates.name) {
                    await client.query(
                        'UPDATE services SET name = $1 WHERE id = $2',
                        [updates.name, serviceId]
                    );
                }

                if (updates.price || updates.duration) {
                    const setClause = [];
                    const values = [masterServiceId];
                    let paramCount = 2;

                    if (updates.price) {
                        setClause.push(`price = $${paramCount}`);
                        values.push(updates.price);
                        paramCount++;
                    }
                    if (updates.duration) {
                        setClause.push(`duration = $${paramCount}`);
                        values.push(updates.duration);
                    }

                    await client.query(
                        `UPDATE master_services 
                        SET ${setClause.join(', ')} 
                        WHERE id = $1`,
                        values
                    );
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error in updateService:', error);
            throw error;
        }
    }

    async deleteService(serviceId, masterId) {
        try {
            const query = `
                UPDATE master_services ms
                SET is_active = false
                FROM masters m
                JOIN users u ON m.user_id = u.id
                WHERE ms.service_id = $1 
                AND u.telegram_id = $2
                RETURNING *
            `;
            const result = await db.query(query, [serviceId, masterId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in deleteService:', error);
            throw error;
        }
    }

    async getMasterServices(masterId) {
        try {
            const query = `
                SELECT 
                    s.id,
                    s.name,
                    ms.price,
                    ms.duration,
                    ms.id as master_service_id
                FROM services s
                JOIN master_services ms ON s.id = ms.service_id
                JOIN masters m ON ms.master_id = m.id
                JOIN users u ON m.user_id = u.id
                WHERE u.telegram_id = $1
                AND ms.is_active = true
                ORDER BY s.name
            `;
            
            const result = await db.query(query, [masterId]);
            return result.rows;
        } catch (error) {
            console.error('Error in getMasterServices:', error);
            throw error;
        }
    }

    async deactivateService(serviceId) {
        try {
            // Начинаем транзакцию
            const client = await db.pool.connect();
            
            try {
                await client.query('BEGIN');

                // Обновляем статус в master_services
                const deactivateQuery = `
                    UPDATE master_services 
                    SET is_active = false
                    WHERE service_id = $1
                    RETURNING *
                `;
                
                const result = await client.query(deactivateQuery, [serviceId]);

                // Если нет активных master_services для этой услуги, 
                // деактивируем саму услугу
                const checkActiveQuery = `
                    SELECT COUNT(*) 
                    FROM master_services 
                    WHERE service_id = $1 AND is_active = true
                `;
                
                const activeCount = await client.query(checkActiveQuery, [serviceId]);
                
                if (parseInt(activeCount.rows[0].count) === 0) {
                    const deactivateServiceQuery = `
                        UPDATE services 
                        SET is_active = false
                        WHERE id = $1
                    `;
                    await client.query(deactivateServiceQuery, [serviceId]);
                }

                await client.query('COMMIT');
                return result.rows[0];
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error in deactivateService:', error);
            throw error;
        }
    }

    async checkMastersExist() {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM masters m 
                JOIN master_services ms ON m.id = ms.master_id 
                WHERE ms.is_active = true
            `;
            const result = await db.pool.query(query);
            return result.rows[0].count > 0;
        } catch (error) {
            console.error('Error checking masters existence:', error);
            throw error;
        }
    }
}

module.exports = new ServiceService(); 