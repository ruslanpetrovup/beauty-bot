const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class DataUtils {
    static generateUniqueId() {
        return uuidv4();
    }

    static hashData(data) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex');
    }

    static formatDateTime(date, format = 'DD.MM.YYYY HH:mm') {
        return moment(date).format(format);
    }

    static parseDateTime(dateStr, format = 'DD.MM.YYYY HH:mm') {
        return moment(dateStr, format);
    }

    static calculateTimeSlots(startTime, endTime, duration) {
        const slots = [];
        let currentTime = moment(startTime);
        const end = moment(endTime);

        while (currentTime.isBefore(end)) {
            slots.push(currentTime.format('HH:mm'));
            currentTime.add(duration, 'minutes');
        }

        return slots;
    }

    static groupByDate(items, dateField = 'date') {
        return items.reduce((groups, item) => {
            const date = moment(item[dateField]).format('YYYY-MM-DD');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(item);
            return groups;
        }, {});
    }

    static calculateDuration(startTime, endTime) {
        return moment(endTime).diff(moment(startTime), 'minutes');
    }

    static isOverlapping(slot1, slot2) {
        const [start1, end1] = slot1;
        const [start2, end2] = slot2;
        
        return moment(start1).isBefore(moment(end2)) && 
               moment(end1).isAfter(moment(start2));
    }

    static sanitizePhoneNumber(phone) {
        return phone.replace(/[^\d+]/g, '');
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static formatPrice(amount, currency = 'UAH') {
        return new Intl.NumberFormat('uk-UA', {
            style: 'currency',
            currency
        }).format(amount);
    }

    static calculateAverageRating(ratings) {
        if (!ratings.length) return 0;
        const sum = ratings.reduce((acc, val) => acc + val, 0);
        return (sum / ratings.length).toFixed(1);
    }

    static paginateArray(array, page, perPage) {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        return array.slice(start, end);
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static mergeObjects(target, source) {
        return Object.entries(source).reduce((acc, [key, value]) => {
            if (value !== null && typeof value === 'object') {
                if (!acc[key]) acc[key] = {};
                acc[key] = this.mergeObjects(acc[key], value);
            } else if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, { ...target });
    }

    static generateTimeWindows(appointments) {
        const windows = [];
        let lastEndTime = null;

        appointments.sort((a, b) => 
            moment(a.startTime).diff(moment(b.startTime))
        );

        appointments.forEach((apt, index) => {
            const startTime = moment(apt.startTime);
            
            if (lastEndTime && startTime.diff(lastEndTime, 'minutes') > 0) {
                windows.push({
                    start: lastEndTime.format(),
                    end: startTime.format(),
                    duration: startTime.diff(lastEndTime, 'minutes')
                });
            }

            lastEndTime = moment(apt.endTime);
        });

        return windows;
    }

    static validateTimeRange(startTime, endTime, minDuration = 0) {
        const start = moment(startTime);
        const end = moment(endTime);
        
        if (!start.isValid() || !end.isValid()) {
            return false;
        }

        if (end.isSameOrBefore(start)) {
            return false;
        }

        if (minDuration > 0) {
            const duration = end.diff(start, 'minutes');
            if (duration < minDuration) {
                return false;
            }
        }

        return true;
    }
}

module.exports = DataUtils; 