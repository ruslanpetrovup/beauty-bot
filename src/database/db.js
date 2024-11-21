const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dev',
  password: 'qwer1234',
  port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    async checkConnection() {
        try {
            const client = await pool.connect();
            client.release();
            return true;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }
};