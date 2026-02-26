const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  env: {
    DB_HOST: process.env.DB_HOST || '190.133.168.179',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || 'iski_db',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '123456',
    JWT_SECRET: process.env.JWT_SECRET || 'iski-report-center-super-secret-key-2026',
  },
};

module.exports = nextConfig;
