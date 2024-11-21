const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createHash } = require('crypto');
const rateLimit = require('express-rate-limit');
const eventNotificationService = require('./eventNotificationService');

class SecurityService {
    constructor() {
        this.loginAttempts = new Map();
        this.suspiciousIPs = new Set();
    }

    async validateLogin(userId, ip) {
        const key = `${userId}:${ip}`;
        const attempts = this.loginAttempts.get(key) || 0;

        if (attempts >= 5) {
            await this.handleSuspiciousActivity({
                type: 'multiple_login_attempts',
                userId,
                ip,
                attempts
            });
            throw new Error('Слишком много попыток входа. Попробуйте позже.');
        }

        this.loginAttempts.set(key, attempts + 1);
        setTimeout(() => this.loginAttempts.delete(key), 15 * 60 * 1000); // 15 минут
    }

    async generateToken(user) {
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                sessionId: await this.createSession(user.id)
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return token;
    }

    async createSession(userId) {
        const query = `
            INSERT INTO user_sessions (
                user_id,
                device_info,
                ip_address,
                last_activity
            )
            VALUES ($1, $2, $3, NOW())
            RETURNING id
        `;

        const result = await db.query(query, [
            userId,
            req.headers['user-agent'],
            req.ip
        ]);

        return result.rows[0].id;
    }

    async validateSession(sessionId, userId) {
        const query = `
            SELECT * FROM user_sessions
            WHERE id = $1 AND user_id = $2 AND is_active = true
        `;

        const result = await db.query(query, [sessionId, userId]);
        return result.rows.length > 0;
    }

    async handleSuspiciousActivity(data) {
        // Записываем подозрительную активность
        const query = `
            INSERT INTO security_alerts (
                type,
                user_id,
                ip_address,
                details,
                created_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
        `;

        const result = await db.query(query, [
            data.type,
            data.userId,
            data.ip,
            JSON.stringify(data)
        ]);

        // Уведомляем администраторов
        await eventNotificationService.handleBusinessEvent({
            type: 'security_alert',
            severity: 'high',
            data: {
                alertType: data.type,
                ip: data.ip,
                timestamp: new Date(),
                details: JSON.stringify(data)
            }
        });

        // Добавляем IP в список подозрительных
        this.suspiciousIPs.add(data.ip);
    }

    async validateRequest(req) {
        // Проверяем IP
        if (this.suspiciousIPs.has(req.ip)) {
            throw new Error('Доступ заблокирован');
        }

        // Проверяем токен
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            throw new Error('Отсутствует токен авторизации');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Проверяем сессию
            if (!await this.validateSession(decoded.sessionId, decoded.id)) {
                throw new Error('Недействительная сессия');
            }

            return decoded;
        } catch (error) {
            throw new Error('Недействительный токен');
        }
    }

    async updatePassword(userId, oldPassword, newPassword) {
        // Проверяем старый пароль
        const user = await this.getUserById(userId);
        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        
        if (!isValid) {
            throw new Error('Неверный текущий пароль');
        }

        // Проверяем сложность нового пароля
        this.validatePasswordStrength(newPassword);

        // Хешируем и сохраняем новый пароль
        const hash = await bcrypt.hash(newPassword, 10);
        
        const query = `
            UPDATE users
            SET 
                password_hash = $2,
                password_updated_at = NOW()
            WHERE id = $1
        `;

        await db.query(query, [userId, hash]);
    }

    validatePasswordStrength(password) {
        if (password.length < 8) {
            throw new Error('Пароль должен содержать минимум 8 символов');
        }

        if (!/[A-Z]/.test(password)) {
            throw new Error('Пароль должен содержать заглавные буквы');
        }

        if (!/[a-z]/.test(password)) {
            throw new Error('Пароль должен содержать строчные буквы');
        }

        if (!/[0-9]/.test(password)) {
            throw new Error('Пароль должен содержать цифры');
        }

        if (!/[!@#$%^&*]/.test(password)) {
            throw new Error('Пароль должен содержать специальные символы');
        }
    }

    getRateLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 минут
            max: 100, // максимум 100 запросов
            message: 'Слишком много запросов. Попробуйте позже.'
        });
    }
}

module.exports = new SecurityService(); 