const moment = require('moment');
const DataUtils = require('./dataUtils');

class MessageUtils {
    static formatAppointmentMessage(appointment) {
        return `
            📅 Запись на ${DataUtils.formatDateTime(appointment.startTime)}
            
            👤 Клиент: ${appointment.clientName}
            📱 Телефон: ${appointment.clientPhone}
            💇 Услуга: ${appointment.serviceName}
            ⏱ Длительность: ${appointment.duration} мин
            💰 Стоимость: ${DataUtils.formatPrice(appointment.price)}
            
            ${appointment.notes ? `📝 Примечания: ${appointment.notes}` : ''}
        `.trim();
    }

    static formatScheduleMessage(schedule) {
        const groupedByDate = DataUtils.groupByDate(schedule);
        
        return Object.entries(groupedByDate)
            .map(([date, appointments]) => {
                const formattedDate = moment(date).format('DD.MM.YYYY');
                const appointmentsList = appointments
                    .map(apt => `${apt.time} - ${apt.clientName} (${apt.serviceName})`)
                    .join('\n');

                return `
                    📅 ${formattedDate}
                    ${appointmentsList}
                `.trim();
            })
            .join('\n\n');
    }

    static formatStatisticsMessage(stats) {
        return `
            📊 Статистика

            💰 Доход: ${DataUtils.formatPrice(stats.revenue)}
            👥 Клиентов: ${stats.clientsCount}
            ✅ Записей: ${stats.appointmentsCount}
            ⭐️ Рейтинг: ${stats.averageRating}
            
            Топ услуг:
            ${stats.topServices
                .map(s => `${s.name}: ${s.count} раз`)
                .join('\n')}
        `.trim();
    }

    static formatErrorMessage(error) {
        return `
            ❌ Ошибка
            
            Тип: ${error.type}
            Сообщение: ${error.message}
            ${error.details ? `Детали: ${error.details}` : ''}
        `.trim();
    }

    static formatNotificationMessage(notification) {
        const types = {
            appointment: '📅 Напоминание о записи',
            review: '⭐️ Новый отзыв',
            payment: '💰 Оплата',
            system: '⚙️ Системное уведомление'
        };

        return `
            ${types[notification.type] || '📢 Уведомление'}
            
            ${notification.message}
            
            ${notification.actionRequired ? 
                '❗️ Требуется действие' : ''}
        `.trim();
    }
}

module.exports = MessageUtils; 