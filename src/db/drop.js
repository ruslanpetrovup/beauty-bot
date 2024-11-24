const sequelize = require('./index');
const models = require('./models');

async function setupDatabase() {
  try {
    console.log('Удаляем старые таблицы, включая зависимости...');

    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    for (const table of tables) {
      console.log(`Удаление таблицы: ${table}`);
      // Удаляем таблицу с зависимостями
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
    }

    console.log('Создаем таблицы для текущих моделей...');
    for (const modelName of Object.keys(models)) {
      const model = models[modelName];
      console.log(`Создание таблицы для модели: ${modelName}`);
      await model.sync({ force: true });
    }

    console.log('База данных успешно пересоздана.');
  } catch (error) {
    console.error('Ошибка при настройке базы данных:', error);
  } finally {
    await sequelize.close();
  }
}

setupDatabase();
