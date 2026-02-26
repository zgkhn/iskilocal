const { Client } = require('pg');
const client = new Client({
    host: '190.133.168.179',
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
    port: 5432,
});

async function check() {
    await client.connect();
    try {
        console.log("Current collector_signals content (Last 20):");
        const res = await client.query("SELECT * FROM collector_signals ORDER BY created_at DESC LIMIT 20;");
        if (res.rows.length === 0) {
            console.log("Table is empty.");
        } else {
            console.table(res.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

check();
