const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    database: process.env.DB_NAME || 'iski_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
});

async function runMigration() {
    const sqlPath = path.join(__dirname, 'init-report-center.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        console.log('Migration başlatılıyor...');
        await pool.query(sql);
        console.log('Migration başarıyla tamamlandı.');
    } catch (err) {
        console.error('Migration hatası:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
