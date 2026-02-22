-- =============================================
-- Rapor İzleme Merkezi - Veritabanı Tabloları
-- =============================================
-- Mevcut tablolar (plcs, monitoring_tables, tags, measurements) korunur.
-- Yeni tablolar rc_ prefixi ile ayrılır.

-- RC Kullanıcılar (Rapor Merkezi'ne özel)
CREATE TABLE IF NOT EXISTS rc_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    fullname VARCHAR(100),
    email VARCHAR(150),
    role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- admin, viewer
    theme_preference VARCHAR(10) DEFAULT 'system', -- light, dark, system
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan admin kullanıcısı (şifre: admin123)
-- bcrypt hash: $2a$10$...
-- Hash runtime'da oluşturulacak, burada plain text olarak kayıt yapılmaz
-- Uygulama ilk çalıştırıldığında admin oluşturulacak

-- Tag Ölçekleme (Scala) Ayarları
CREATE TABLE IF NOT EXISTS rc_tag_scales (
    id SERIAL PRIMARY KEY,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    multiply_factor DOUBLE PRECISION DEFAULT 1.0,
    divide_factor DOUBLE PRECISION DEFAULT 1.0,
    offset_value DOUBLE PRECISION DEFAULT 0.0,
    decimal_precision INTEGER DEFAULT 2,
    decimal_separator CHAR(1) DEFAULT ',',
    thousand_separator CHAR(1) DEFAULT '.',
    max_digits INTEGER,
    unit VARCHAR(50) DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES rc_users(id),
    UNIQUE(tag_id)
);

-- Migrations for existing tables
ALTER TABLE rc_tag_scales ADD COLUMN IF NOT EXISTS decimal_separator CHAR(1) DEFAULT ',';
ALTER TABLE rc_tag_scales ADD COLUMN IF NOT EXISTS thousand_separator CHAR(1) DEFAULT '.';
ALTER TABLE rc_tag_scales ADD COLUMN IF NOT EXISTS max_digits INTEGER;

-- Dinamik Rapor Sayfası Tanımları
CREATE TABLE IF NOT EXISTS rc_report_pages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    plc_id INTEGER REFERENCES plcs(id) ON DELETE SET NULL,
    monitoring_table_id INTEGER REFERENCES monitoring_tables(id) ON DELETE SET NULL,
    tag_ids JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES rc_users(id)
);

-- Audit Log Tablosu (Silinemez)
CREATE TABLE IF NOT EXISTS rc_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES rc_users(id) ON DELETE SET NULL,
    username VARCHAR(50),
    action_type VARCHAR(50) NOT NULL,
    -- Tipleri: LOGIN, LOGOUT, FAILED_LOGIN, REPORT_VIEW, REPORT_TREND,
    -- EXPORT_EXCEL, EXPORT_PDF, USER_CREATE, USER_UPDATE, USER_DELETE,
    -- ROLE_CHANGE, SCALE_CREATE, SCALE_UPDATE, SCALE_DELETE,
    -- REPORT_PAGE_CREATE, REPORT_PAGE_UPDATE, REPORT_PAGE_DELETE,
    -- TICKET_CREATE, TICKET_UPDATE, TICKET_MESSAGE
    category VARCHAR(30) NOT NULL DEFAULT 'system',
    -- Kategoriler: auth, report, export, admin, ticket, system
    description TEXT,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit log indeksleri (performans)
CREATE INDEX IF NOT EXISTS idx_rc_audit_logs_user_id ON rc_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rc_audit_logs_action_type ON rc_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_rc_audit_logs_category ON rc_audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_rc_audit_logs_created_at ON rc_audit_logs(created_at DESC);

-- Destek Talepleri
CREATE TABLE IF NOT EXISTS rc_support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES rc_users(id) ON DELETE SET NULL,
    subject VARCHAR(300) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    -- Kategoriler: general, bug, feature, data, access
    priority VARCHAR(20) DEFAULT 'normal',
    -- Öncelikler: low, normal, high, critical
    status VARCHAR(20) DEFAULT 'open',
    -- Durumlar: open, in_progress, resolved, closed
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rc_support_tickets_user_id ON rc_support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_rc_support_tickets_status ON rc_support_tickets(status);

-- Talep Mesajları
CREATE TABLE IF NOT EXISTS rc_ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES rc_support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES rc_users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Talep Dosya Ekleri
CREATE TABLE IF NOT EXISTS rc_ticket_attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES rc_support_tickets(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES rc_ticket_messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sistem Ayarları
CREATE TABLE IF NOT EXISTS rc_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan ayarlar
INSERT INTO rc_settings (key, value) VALUES
    ('default_theme', 'dark'),
    ('company_name', 'İSKİ'),
    ('company_logo', '/logo.png'),
    ('session_timeout_hours', '24'),
    ('max_export_rows', '50000')
ON CONFLICT (key) DO NOTHING;

-- Aylık partition oluşturma fonksiyonu (measurements tablosu için)
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'measurements_y' || to_char(start_date, 'YYYY') || 'm' || to_char(start_date, 'MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF measurements FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Mevcut ay için partition oluştur
SELECT create_monthly_partition();

-- Kullanıcı-Rapor İzin Tablosu
CREATE TABLE IF NOT EXISTS rc_user_report_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES rc_users(id) ON DELETE CASCADE,
    report_id INTEGER NOT NULL REFERENCES rc_report_pages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, report_id)
);
