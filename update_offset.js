const { Client } = require('pg');
const client = new Client({ host: '190.133.168.179', database: 'iski_db', user: 'postgres', password: '123456', port: 5432 });
client.connect().then(async () => {
    await client.query("UPDATE plcs SET address_offset = 0 WHERE name = 'Orhaniye'");
    const res = await client.query("SELECT name, address_offset FROM plcs WHERE name = 'Orhaniye'");
    console.log('Updated:', JSON.stringify(res.rows[0]));
    await client.end();
}).catch(e => { console.error(e); process.exit(1); });
