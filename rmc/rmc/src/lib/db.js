import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'iski_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text);
    }
    return res;
}

export async function getClient() {
    const client = await pool.connect();
    return client;
}

export default pool;
