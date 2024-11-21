const db = require('../database/db');
const ExcelJS = require('exceljs');
const moment = require('moment');

class ReportingService {
    async generateDetailedReport(masterId, options) {
        const workbook = new ExcelJS.Workbook();
        
        // Финансовый отчет
        await this.addFinancialSheet(workbook, masterId, options);
        
        // Статистика по клиентам
        await this.addClientStatisticsSheet(workbook, masterId, options);
        
        // Статистика по услугам
        await this.addServicesStatisticsSheet(workbook, masterId, options);
        
        // Статистика по сотрудникам
        await this.addEmployeeStatisticsSheet(workbook, masterId, options);
        
        // Сохраняем файл
        const fileName = `report_${masterId}_${moment().format('YYYY-MM-DD')}.xlsx`;
        await workbook.xlsx.writeFile(`./reports/${fileName}`);
        
        return fileName;
    }

    async addFinancialSheet(workbook, masterId, options) {
        const sheet = workbook.addWorksheet('Финансы');
        
        sheet.columns = [
            { header: 'Дата', key: 'date', width: 15 },
            { header: 'Доход', key: 'revenue', width: 15 },
            { header: 'Расходы', key: 'expenses', width: 15 },
            { header: 'Прибыль', key: 'profit', width: 15 },
            { header: 'Количество записей', key: 'appointments', width: 20 },
            { header: 'Средний чек', key: 'average_check', width: 15 }
        ];

        const query = `
            SELECT 
                DATE_TRUNC('day', a.start_time) as date,
                SUM(s.price) as revenue,
                SUM(CASE 
                    WHEN e.salary_type = 'commission' 
                    THEN s.price * (e.commission_percentage / 100)
                    ELSE e.salary_amount
                END) as expenses,
                COUNT(a.id) as appointments
            FROM appointments a
            JOIN services s ON a.service_id = s.id
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE 
                a.master_id = $1
                AND a.start_time BETWEEN $2 AND $3
                AND a.status = 'completed'
            GROUP BY DATE_TRUNC('day', a.start_time)
            ORDER BY date DESC
        `;

        const result = await db.query(query, [
            masterId,
            options.dateFrom,
            options.dateTo
        ]);

        result.rows.forEach(row => {
            sheet.addRow({
                date: moment(row.date).format('DD.MM.YYYY'),
                revenue: row.revenue,
                expenses: row.expenses,
                profit: row.revenue - row.expenses,
                appointments: row.appointments,
                average_check: (row.revenue / row.appointments).toFixed(2)
            });
        });

        // Добавляем итоги
        const totalRow = sheet.addRow({
            date: 'ИТОГО:',
            revenue: result.rows.reduce((sum, row) => sum + row.revenue, 0),
            expenses: result.rows.reduce((sum, row) => sum + row.expenses, 0),
            profit: result.rows.reduce((sum, row) => sum + (row.revenue - row.expenses), 0),
            appointments: result.rows.reduce((sum, row) => sum + row.appointments, 0),
            average_check: (
                result.rows.reduce((sum, row) => sum + row.revenue, 0) / 
                result.rows.reduce((sum, row) => sum + row.appointments, 0)
            ).toFixed(2)
        });
        totalRow.font = { bold: true };
    }

    async addClientStatisticsSheet(workbook, masterId, options) {
        const sheet = workbook.addWorksheet('Клиенты');
        
        sheet.columns = [
            { header: 'Клиент', key: 'client_name', width: 20 },
            { header: 'Количество визитов', key: 'visits', width: 20 },
            { header: 'Общая сумма', key: 'total_spent', width: 15 },
            { header: 'Средний чек', key: 'average_check', width: 15 },
            { header: 'Последний визит', key: 'last_visit', width: 15 },
            { header: 'Средняя оценка', key: 'average_rating', width: 15 }
        ];

        const query = `
            SELECT 
                u.name as client_name,
                COUNT(a.id) as visits,
                SUM(s.price) as total_spent,
                MAX(a.start_time) as last_visit,
                AVG(r.rating) as average_rating
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            JOIN services s ON a.service_id = s.id
            LEFT JOIN reviews r ON r.appointment_id = a.id
            WHERE 
                a.master_id = $1
                AND a.start_time BETWEEN $2 AND $3
                AND a.status = 'completed'
            GROUP BY u.id, u.name
            ORDER BY visits DESC
        `;

        const result = await db.query(query, [
            masterId,
            options.dateFrom,
            options.dateTo
        ]);

        result.rows.forEach(row => {
            sheet.addRow({
                client_name: row.client_name,
                visits: row.visits,
                total_spent: row.total_spent,
                average_check: (row.total_spent / row.visits).toFixed(2),
                last_visit: moment(row.last_visit).format('DD.MM.YYYY'),
                average_rating: row.average_rating?.toFixed(1) || 'Нет оценок'
            });
        });
    }
}

module.exports = new ReportingService(); 