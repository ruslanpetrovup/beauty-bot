const db = require('../db'); // Импортируем модуль db
const fs = require('fs').promises;
const path = require('path');

async function resetDatabase() {
    try {
        console.log('Starting database reset...');
        
        // Удаляем все таблицы
        const dropTablesQuery = `
            DROP TABLE IF EXISTS master_services CASCADE;
            DROP TABLE IF EXISTS appointments CASCADE;
            DROP TABLE IF EXISTS time_slots CASCADE;
            DROP TABLE IF EXISTS services CASCADE;
            DROP TABLE IF EXISTS service_categories CASCADE;
            DROP TABLE IF EXISTS masters CASCADE;
            DROP TABLE IF EXISTS user_roles CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `;
        
        await db.query(dropTablesQuery);
        console.log('All tables dropped successfully');

        // Создаем таблицы заново
        const sqlFile = path.join(__dirname, 'init.sql');
        const sql = await fs.readFile(sqlFile, 'utf8');
        
        const commands = sql.split(';')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        for (const command of commands) {
            await db.query(command);
        }
        
        console.log('Tables created successfully');
    } catch (error) {
        console.error('Reset database error:', error);
        process.exit(1);
    }
}

resetDatabase();