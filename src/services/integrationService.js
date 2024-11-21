const axios = require('axios');
const db = require('../database/db');
const { createHmac } = require('crypto');
const crypto = require('crypto');
const moment = require('moment');
const loggingService = require('./loggingService');
const cacheService = require('./cacheService');

class IntegrationService {
    constructor() {
        this.integrations = {
            monobank: {
                baseUrl: process.env.MONOBANK_API_URL,
                token: process.env.MONOBANK_TOKEN
            },
            novaposhta: {
                baseUrl: process.env.NOVAPOSHTA_API_URL,
                apiKey: process.env.NOVAPOSHTA_API_KEY
            },
            instagram: {
                baseUrl: 'https://graph.instagram.com',
                clientId: process.env.INSTAGRAM_CLIENT_ID,
                clientSecret: process.env.INSTAGRAM_CLIENT_SECRET
            },
            telegram: {
                token: process.env.TELEGRAM_BOT_TOKEN,
                apiUrl: 'https://api.telegram.org'
            },
            viber: {
                token: process.env.VIBER_TOKEN,
                apiUrl: 'https://chatapi.viber.com/pa'
            },
            googleCalendar: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: process.env.GOOGLE_REDIRECT_URI
            },
            sms: {
                provider: process.env.SMS_PROVIDER,
                apiKey: process.env.SMS_API_KEY,
                sender: process.env.SMS_SENDER
            },
            payment: {
                provider: process.env.PAYMENT_PROVIDER,
                merchantId: process.env.PAYMENT_MERCHANT_ID,
                secretKey: process.env.PAYMENT_SECRET_KEY
            }
        };
    }

    async connectMonobank(masterId, token) {
        try {
            // Проверяем токен
            const response = await axios.get(
                `${this.integrations.monobank.baseUrl}/personal/client-info`,
                { headers: { 'X-Token': token } }
            );

            if (response.data) {
                await this.saveIntegrationCredentials(
                    masterId,
                    'monobank',
                    { token }
                );
                return true;
            }
        } catch (error) {
            console.error('Monobank integration error:', error);
            throw new Error('Неверный токен Monobank');
        }
    }

    async getMonobankTransactions(masterId, from, to) {
        const credentials = await this.getIntegrationCredentials(masterId, 'monobank');
        if (!credentials) throw new Error('Monobank не подключен');

        const response = await axios.get(
            `${this.integrations.monobank.baseUrl}/personal/statement/${from}/${to}`,
            { headers: { 'X-Token': credentials.token } }
        );

        return response.data;
    }

    async connectInstagram(masterId, code) {
        try {
            // Получаем access token
            const tokenResponse = await axios.post(
                'https://api.instagram.com/oauth/access_token',
                {
                    client_id: this.integrations.instagram.clientId,
                    client_secret: this.integrations.instagram.clientSecret,
                    grant_type: 'authorization_code',
                    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
                    code
                }
            );

            if (tokenResponse.data.access_token) {
                await this.saveIntegrationCredentials(
                    masterId,
                    'instagram',
                    {
                        accessToken: tokenResponse.data.access_token,
                        userId: tokenResponse.data.user_id
                    }
                );
                return true;
            }
        } catch (error) {
            console.error('Instagram integration error:', error);
            throw new Error('Ошибка подключения Instagram');
        }
    }

    async postToInstagram(masterId, imageUrl, caption) {
        const credentials = await this.getIntegrationCredentials(masterId, 'instagram');
        if (!credentials) throw new Error('Instagram не подключен');

        try {
            // Создаем медиа-контейнер
            const containerResponse = await axios.post(
                `${this.integrations.instagram.baseUrl}/media`,
                {
                    image_url: imageUrl,
                    caption,
                    access_token: credentials.accessToken
                }
            );

            // Публикуем пост
            if (containerResponse.data.id) {
                const publishResponse = await axios.post(
                    `${this.integrations.instagram.baseUrl}/media_publish`,
                    {
                        creation_id: containerResponse.data.id,
                        access_token: credentials.accessToken
                    }
                );

                return publishResponse.data;
            }
        } catch (error) {
            console.error('Instagram posting error:', error);
            throw new Error('Ошибка публикации в Instagram');
        }
    }

    async calculateNovaposhtaDelivery(cityFrom, cityTo, weight) {
        try {
            const response = await axios.post(
                this.integrations.novaposhta.baseUrl,
                {
                    apiKey: this.integrations.novaposhta.apiKey,
                    modelName: 'InternetDocument',
                    calledMethod: 'getDocumentPrice',
                    methodProperties: {
                        CitySender: cityFrom,
                        CityRecipient: cityTo,
                        Weight: weight,
                        ServiceType: 'WarehouseWarehouse'
                    }
                }
            );

            return response.data.data[0];
        } catch (error) {
            console.error('Nova Poshta calculation error:', error);
            throw new Error('Ошибка расчета доставки');
        }
    }

    async saveIntegrationCredentials(masterId, service, credentials) {
        const query = `
            INSERT INTO integration_credentials (
                master_id,
                service,
                credentials,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (master_id, service) 
            DO UPDATE SET 
                credentials = $3,
                updated_at = NOW()
        `;

        return db.query(query, [
            masterId,
            service,
            credentials
        ]);
    }

    async getIntegrationCredentials(masterId, service) {
        const query = `
            SELECT credentials
            FROM integration_credentials
            WHERE master_id = $1 AND service = $2
        `;

        const result = await db.query(query, [masterId, service]);
        return result.rows[0]?.credentials;
    }

    async sendNotification(channel, recipient, message, options = {}) {
        try {
            switch (channel) {
                case 'telegram':
                    return await this.sendTelegramMessage(recipient, message, options);
                case 'viber':
                    return await this.sendViberMessage(recipient, message, options);
                case 'sms':
                    return await this.sendSMS(recipient, message);
                default:
                    throw new Error(`Unsupported channel: ${channel}`);
            }
        } catch (error) {
            loggingService.logError(error, {
                context: 'notification',
                channel,
                recipient
            });
            throw error;
        }
    }

    async createPayment(orderId, amount, description) {
        try {
            const signature = this.generatePaymentSignature(orderId, amount);
            
            const response = await axios.post(
                `${this.integrations.payment.provider}/api/payment`,
                {
                    merchantId: this.integrations.payment.merchantId,
                    orderId,
                    amount,
                    description,
                    signature
                }
            );

            return response.data;
        } catch (error) {
            loggingService.logError(error, {
                context: 'payment_creation',
                orderId
            });
            throw error;
        }
    }

    generatePaymentSignature(orderId, amount) {
        const data = `${this.integrations.payment.merchantId}:${amount}:${orderId}`;
        return crypto
            .createHmac('sha256', this.integrations.payment.secretKey)
            .update(data)
            .digest('hex');
    }

    async syncCalendarEvents(masterId, events) {
        const credentials = await this.getGoogleCredentials(masterId);
        if (!credentials) {
            throw new Error('Google Calendar not connected');
        }

        const calendar = google.calendar({ version: 'v3', auth: credentials });

        for (const event of events) {
            try {
                await calendar.events.insert({
                    calendarId: 'primary',
                    resource: {
                        summary: event.title,
                        description: event.description,
                        start: { dateTime: event.startTime },
                        end: { dateTime: event.endTime }
                    }
                });
            } catch (error) {
                loggingService.logError(error, {
                    context: 'calendar_sync',
                    eventId: event.id
                });
            }
        }
    }

    async sendSMS(phone, message) {
        try {
            const response = await axios.post(
                `${this.integrations.sms.provider}/send`,
                {
                    apiKey: this.integrations.sms.apiKey,
                    sender: this.integrations.sms.sender,
                    phone,
                    message
                }
            );

            return response.data;
        } catch (error) {
            loggingService.logError(error, {
                context: 'sms_sending',
                phone
            });
            throw error;
        }
    }

    async verifyWebhookSignature(signature, payload) {
        const expectedSignature = crypto
            .createHmac('sha256', this.integrations.payment.secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');

        return signature === expectedSignature;
    }

    async handleWebhook(type, payload, signature) {
        if (!this.verifyWebhookSignature(signature, payload)) {
            throw new Error('Invalid webhook signature');
        }

        switch (type) {
            case 'payment':
                await this.handlePaymentWebhook(payload);
                break;
            case 'calendar':
                await this.handleCalendarWebhook(payload);
                break;
            default:
                throw new Error(`Unknown webhook type: ${type}`);
        }
    }
}

module.exports = new IntegrationService(); 