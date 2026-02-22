-- plcs tablosu
CREATE TABLE IF NOT EXISTS plcs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    port INTEGER NOT NULL DEFAULT 502,
    protocol VARCHAR(50) NOT NULL DEFAULT 'ModbusTCP',
    timeout_ms INTEGER NOT NULL DEFAULT 2000,
    retry_count INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- monitoring_tables tablosu
CREATE TABLE IF NOT EXISTS monitoring_tables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    plc_id INTEGER REFERENCES plcs(id) ON DELETE CASCADE,
    polling_interval_ms INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- tags tablosu
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    monitoring_table_id INTEGER REFERENCES monitoring_tables(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    plc_address VARCHAR(50) NOT NULL,
    data_type VARCHAR(50) NOT NULL, -- int, float, bool
    unit VARCHAR(50),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- measurements tablosu (Partitioned)
CREATE TABLE IF NOT EXISTS measurements (
    id BIGSERIAL,
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    timestamp TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    CONSTRAINT measurements_pkey PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Örnek: İçinde bulunduğumuz ay için bir partition oluşturulması
-- CREATE TABLE measurements_y2026m02 PARTITION OF measurements FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Indexler
CREATE INDEX IF NOT EXISTS idx_measurements_tag_timestamp ON measurements (tag_id, timestamp DESC);

-- system_logs tablosu
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- INFO, WARNING, ERROR, FATAL
    message TEXT NOT NULL,
    exception TEXT,
    plc_id INTEGER REFERENCES plcs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);

-- Kullanıcılar (Giriş yetkisi için)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    fullname VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan Uygulama Kullanıcısı (Kullanıcı: admin, Şifre: 123456)
INSERT INTO users (username, password_hash, fullname) 
VALUES ('admin', '123456', 'İSKİ Ömerli Otomasyon Amiri')
ON CONFLICT (username) DO NOTHING;
