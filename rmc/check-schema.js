const { Client } = require('pg');
const client = new Client({
    host: '190.133.168.179',
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
    port: 5432,
});

async function checkSchema() {
    await client.connect();
    try {
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'collector_signals'");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkSchema();
