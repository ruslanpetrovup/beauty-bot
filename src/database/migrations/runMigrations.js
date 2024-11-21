const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

async function tableExists(tableName) {
    const query = `
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = $1
        );
    `;
    const result = await db.query(query, [tableName]);
    return result.rows[0].exists;
}

async function runMigrations() {
    try {
        console.log('Starting migrations...');
        
        const sqlFile = path.join(__dirname, 'init.sql');
        const sql = await fs.readFile(sqlFile, 'utf8');
        
        // Разделяем SQL-файл на отдельные команды создания таблиц
        const tableCreationCommands = sql.split(';')
            .map(command => command.trim())
            .filter(command => command.length > 0);

        for (const command of tableCreationCommands) {
            // Извлекаем имя таблицы из команды CREATE TABLE
            const tableNameMatch = command.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);
            if (tableNameMatch) {
                const tableName = tableNameMatch[1].toLowerCase();
                const exists = await tableExists(tableName);
                
                if (exists) {
                    console.log(`Table "${tableName}" already exists, skipping...`);
                } else {
                    console.log(`Creating table "${tableName}"...`);
                    await db.query(command);
                    console.log(`Table "${tableName}" created successfully`);
                }
            }
        }

        // Создаем базовые категории услуг
        await createDefaultCategories();
        
        console.log('Migrations completed successfully');
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

async function createDefaultCategories() {
    const categories = [
        { name: '💅 Маникюр', description: 'Маникюр и уход за ногтями' },
        { name: '💇‍♀️ Стрижка', description: 'Стрижка и укладка волос' },
        { name: '💆‍♀️ Массаж', description: 'Различные виды массажа' },
        { name: '💄 Макияж', description: 'Макияж и уход за кожей' }
    ];

    const exists = await tableExists('service_categories');
    if (!exists) {
        console.log('Table service_categories does not exist, skipping categories creation');
        return;
    }

    const checkQuery = 'SELECT COUNT(*) FROM service_categories';
    const result = await db.query(checkQuery);
    
    if (result.rows[0].count === '0') {
        console.log('Creating default service categories...');
        const insertQuery = `
            INSERT INTO service_categories (name, description)
            VALUES ($1, $2)
        `;
        
        for (const category of categories) {
            await db.query(insertQuery, [category.name, category.description]);
        }
        console.log('Default categories created');
    } else {
        console.log('Categories already exist, skipping...');
    }
}

runMigrations(); 