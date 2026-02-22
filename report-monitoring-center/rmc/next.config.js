const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || 'iski_db',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '123456',
    JWT_SECRET: process.env.JWT_SECRET || 'iski-report-center-super-secret-key-2026',
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  }
};

module.exports = nextConfig;
