const { Pool } = require('pg');

const pool = new Pool({
    host: '190.133.168.179',
    port: 5432,
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
});

async function checkTables() {
    const tables = ['rc_users', 'rc_report_pages', 'rc_audit_logs', 'rc_user_report_permissions'];
    console.log('Checking RMC tables...');

    for (const table of tables) {
        try {
            const res = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`);
            console.log(`${table}: ${res.rows[0].exists ? 'EXISTS' : 'MISSING'}`);
        } catch (err) {
            console.error(`Error checking ${table}:`, err.message);
        }
    }
    await pool.end();
}

checkTables();
