const { Client } = require('pg');
const client = new Client({
    host: '190.133.168.179',
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
    port: 5432,
});

client.connect()
    .then(async () => {
        try {
            // Verify that we can find the PENDING signal after a mock update
            const res = await client.query("SELECT * FROM collector_signals ORDER BY created_at DESC LIMIT 10;");
            console.table(res.rows);
        } catch (e) {
            console.error(e);
        } finally {
            client.end();
        }
    });
