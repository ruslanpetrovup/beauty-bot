const db = require('../database/db');

class UserService {
    async createUser({ telegramId, name, phone, userType = 'client', salonName = null }) {
        try {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                // Создаем пользователя
                const userQuery = `
                    INSERT INTO users (telegram_id, name, phone, "current_role")
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                `;
                const userResult = await client.query(userQuery, [telegramId, name, phone, userType]);
                const userId = userResult.rows[0].id;

                // Добавляем роль
                const roleQuery = `
                    INSERT INTO user_roles (user_id, "role_type")
                    VALUES ($1, $2)
                `;
                await client.query(roleQuery, [userId, userType]);

                // Если регистрируется мастер, создаем запись в таблице masters
                if (userType === 'master' && salonName) {
                    const masterQuery = `
                        INSERT INTO masters (user_id, salon_name)
                        VALUES ($1, $2)
                    `;
                    await client.query(masterQuery, [userId, salonName]);
                }

                await client.query('COMMIT');
                return userResult.rows[0];
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error in createUser:', error);
            throw error;
        }
    }

    async getUserByTelegramId(telegramId) {
        try {
            const query = `
                SELECT 
                    u.*,
                    ARRAY_AGG(ur."role_type") as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                WHERE u.telegram_id = $1 AND ur.is_active = true
                GROUP BY u.id
            `;
            const result = await db.query(query, [telegramId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in getUserByTelegramId:', error);
            throw error;
        }
    }

    async addUserRole(telegramId, roleType) {
        try {
            const user = await this.getUserByTelegramId(telegramId);
            if (!user) throw new Error('User not found');

            const query = `
                INSERT INTO user_roles (user_id, role_type)
                VALUES ($1, $2)
                ON CONFLICT (user_id, role_type) 
                DO UPDATE SET is_active = true
                RETURNING *
            `;
            await db.query(query, [user.id, roleType]);
            return true;
        } catch (error) {
            console.error('Error in addUserRole:', error);
            throw error;
        }
    }

    async removeUserRole(telegramId, roleType) {
        try {
            const user = await this.getUserByTelegramId(telegramId);
            if (!user) throw new Error('User not found');

            const query = `
                UPDATE user_roles 
                SET is_active = false
                WHERE user_id = $1 AND role_type = $2
            `;
            await db.query(query, [user.id, roleType]);
            return true;
        } catch (error) {
            console.error('Error in removeUserRole:', error);
            throw error;
        }
    }

    async getUserRoles(telegramId) {
        try {
            const query = `
                SELECT "role_type"
                FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                WHERE u.telegram_id = $1 AND ur.is_active = true
            `;
            const result = await db.query(query, [telegramId]);
            return result.rows.map(row => row.role_type) || [];
        } catch (error) {
            console.error('Error in getUserRoles:', error);
            return [];
        }
    }

    async createMaster({ userId, salonName }) {
        try {
            const query = `
                INSERT INTO masters (user_id, salon_name)
                VALUES ($1, $2)
                RETURNING *
            `;
            const result = await db.query(query, [userId, salonName]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in createMaster:', error);
            throw error;
        }
    }

    async updateUserRole(telegramId, role) {
        try {
            const query = `
                UPDATE users 
                SET "current_role" = $1 
                WHERE telegram_id = $2 
                RETURNING *
            `;
            const result = await db.query(query, [role, telegramId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating user role:', error);
            throw error;
        }
    }

    async getUserRole(telegramId) {
        try {
            const query = `
                SELECT current_role 
                FROM users 
                WHERE telegram_id = $1
            `;
            const result = await db.query(query, [telegramId]);
            return result.rows[0]?.current_role || 'client';
        } catch (error) {
            console.error('Error getting user role:', error);
            throw error;
        }
    }
}

module.exports = new UserService(); 