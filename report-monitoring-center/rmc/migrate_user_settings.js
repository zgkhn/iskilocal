const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
});

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rc_user_report_settings (
                user_id INTEGER NOT NULL,
                report_id INTEGER NOT NULL,
                config JSONB DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (user_id, report_id)
            )
        `);
        console.log('✅ rc_user_report_settings table created or already exists');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
