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
        console.log('--- ALL PLCs ---');
        const resPlcs = await client.query("SELECT id, name, ip_address, is_active, manufacturer FROM plcs;");
        console.table(resPlcs.rows);

        console.log('--- Search for 190.133.168.62 ---');
        const resSpecific = await client.query("SELECT * FROM plcs WHERE ip_address = '190.133.168.62';");
        if (resSpecific.rows.length === 0) {
            console.log('PLC with IP 190.133.168.62 NOT FOUND in database.');
        } else {
            console.log('PLC FOUND:');
            console.table(resSpecific.rows);

            const plcId = resSpecific.rows[0].id;
            console.log(`--- Monitoring Tables for PLC ID ${plcId} ---`);
            const resTables = await client.query("SELECT id, name, is_active, polling_interval_ms FROM monitoring_tables WHERE plc_id = $1;", [plcId]);
            console.table(resTables.rows);

            if (resTables.rows.length > 0) {
                const tableIds = resTables.rows.map(r => r.id);
                console.log(`--- Tags for Tables [${tableIds.join(', ')}] ---`);
                const resTags = await client.query("SELECT id, monitoring_table_id, name, plc_address, data_type, is_active FROM tags WHERE monitoring_table_id = ANY($1::int[]);", [tableIds]);
                console.table(resTags.rows);
            }
        }
        client.end();
    })
    .catch(err => {
        console.error('Connection error:', err.stack);
        process.exit(1);
    });
