const db = require('../database/db');
const LiqPay = require('liqpay');
const { LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY } = require('../config/config');

class PaymentService {
    constructor() {
        this.liqpay = new LiqPay(LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY);
    }

    async createPaymentLink(appointmentId, amount) {
        const appointment = await this.getAppointmentDetails(appointmentId);
        
        const paymentData = {
            action: 'pay',
            amount: amount,
            currency: 'UAH',
            description: `Оплата услуги ${appointment.service_name}`,
            order_id: `appointment_${appointmentId}_${Date.now()}`,
            version: '3',
            result_url: `${process.env.BOT_URL}/payment/callback`,
            server_url: `${process.env.BOT_URL}/payment/webhook`,
            sandbox: process.env.NODE_ENV !== 'production' // Режим тестирования
        };

        const paymentLink = this.liqpay.cnb_link(paymentData);
        
        // Сохраняем информацию о платеже
        await this.savePaymentRequest(appointmentId, paymentData.order_id, amount);
        
        return paymentLink;
    }

    async handlePaymentCallback(data) {
        const decodedData = this.liqpay.decode_data(data);
        
        if (decodedData.status === 'success') {
            const orderId = decodedData.order_id;
            const [, appointmentId] = orderId.split('_');
            
            await this.confirmPayment(appointmentId, {
                status: 'completed',
                transaction_id: decodedData.transaction_id,
                payment_method: 'liqpay'
            });
            
            return true;
        }
        
        return false;
    }

    async savePaymentRequest(appointmentId, orderId, amount) {
        const query = `
            INSERT INTO payment_requests (
                appointment_id, 
                order_id, 
                amount, 
                status
            )
            VALUES ($1, $2, $3, 'pending')
            RETURNING id
        `;
        
        return db.query(query, [appointmentId, orderId, amount]);
    }

    async confirmPayment(appointmentId, paymentDetails) {
        const query = `
            UPDATE appointments
            SET 
                payment_status = $2,
                payment_transaction_id = $3,
                payment_method = $4,
                payment_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        
        return db.query(query, [
            appointmentId,
            paymentDetails.status,
            paymentDetails.transaction_id,
            paymentDetails.payment_method
        ]);
    }

    async getAppointmentDetails(appointmentId) {
        const query = `
            SELECT 
                a.*,
                s.name as service_name,
                s.price
            FROM appointments a
            JOIN services s ON a.service_id = s.id
            WHERE a.id = $1
        `;
        
        const result = await db.query(query, [appointmentId]);
        return result.rows[0];
    }
}

module.exports = new PaymentService(); 