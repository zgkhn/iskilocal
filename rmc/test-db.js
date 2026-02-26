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
        console.log('Connected to database.');
        try {
            await client.query("ALTER TABLE plcs ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(50) DEFAULT 'Generic';");
            console.log('Column "manufacturer" added successfully to "plcs" table.');
        } catch (err) {
            console.error('Error adding column:', err.message);
        } finally {
            client.end();
        }
    })
    .catch(err => {
        console.error('Connection error:', err.stack);
        process.exit(1);
    });
