const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
    host: '190.133.168.179',
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
    port: 5432,
});

async function run() {
    await client.connect();
    const result = {};

    const plcs = await client.query("SELECT * FROM plcs");
    result.plcs = plcs.rows;

    const monitoringTables = await client.query("SELECT * FROM monitoring_tables");
    result.monitoring_tables = monitoringTables.rows;

    const tags = await client.query("SELECT * FROM tags");
    result.tags = tags.rows;

    fs.writeFileSync('db_dump.json', JSON.stringify(result, null, 2));
    console.log('Database dump written to db_dump.json');
    await client.end();
}

run().catch(console.error);
