const { Client } = require('pg');
const client = new Client({
    host: '190.133.168.179',
    database: 'iski_db',
    user: 'postgres',
    password: '123456',
    port: 5432,
});

async function run() {
    await client.connect();
    try {
        console.log("1. Simulating a change (PLC Insert/Update)...");
        // We'll manually insert a PENDING signal as if a CRUD operation happened
        await client.query("INSERT INTO collector_signals (signal_type) VALUES ('PENDING')");

        console.log("2. Checking PENDING signals...");
        let res = await client.query("SELECT * FROM collector_signals WHERE signal_type = 'PENDING' AND is_processed = false");
        console.table(res.rows);

        console.log("3. Simulating 'Apply Changes' (Requesting RELOAD)...");
        // This simulates RequestCollectorReloadAsync logic
        await client.query("INSERT INTO collector_signals (signal_type) VALUES ('RELOAD')");
        await client.query("UPDATE collector_signals SET is_processed = true WHERE signal_type = 'PENDING'");

        console.log("4. Verifying state...");
        res = await client.query("SELECT * FROM collector_signals ORDER BY created_at DESC LIMIT 5");
        console.table(res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
