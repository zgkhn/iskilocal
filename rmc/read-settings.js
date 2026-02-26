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
            const res = await client.query("SELECT * FROM rc_settings");
            console.table(res.rows);
        } catch (e) {
            console.error(e);
        } finally {
            client.end();
        }
    });
