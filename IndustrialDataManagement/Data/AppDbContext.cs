using System.Data;
using Dapper;
using IndustrialDataManagement.Models;
using Npgsql;

namespace IndustrialDataManagement.Data;

public class AppDbContext
{
    private readonly string _connectionString;

    public AppDbContext(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
                            ?? throw new InvalidOperationException("Varsayılan bağlantı dizesi bulunamadı.");
        
        // Tabloların varlığını başlangıçta kontrol et ve oluştur
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        using var connection = CreateConnection();
        // Users tablosu yoksa oluştur ve admin kullanıcısını ekle
        var sql = @"
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                fullname VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS collector_signals (
                id SERIAL PRIMARY KEY,
                signal_type VARCHAR(50) NOT NULL,
                is_processed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            INSERT INTO users (username, password_hash, fullname) 
            VALUES ('admin', '123456', 'İSKİ Ömerli Otomasyon Amiri')
            ON CONFLICT (username) DO NOTHING;";
        
        connection.Execute(sql);
    }

    public IDbConnection CreateConnection()
    {
        return new NpgsqlConnection(_connectionString);
    }

    // --- PLC İşlemleri ---
    public async Task<IEnumerable<Plc>> GetAllPlcsAsync()
    {
        using var connection = CreateConnection();
        return await connection.QueryAsync<Plc>("SELECT * FROM plcs ORDER BY id DESC");
    }

    public async Task<Plc?> GetPlcByIdAsync(int id)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<Plc>("SELECT * FROM plcs WHERE id = @Id", new { Id = id });
    }

    public async Task InsertPlcAsync(Plc plc)
    {
        using var connection = CreateConnection();
        var sql = @"INSERT INTO plcs (name, ip_address, port, protocol, timeout_ms, retry_count, is_active, manufacturer, address_offset) 
                    VALUES (@Name, @IpAddress, @Port, @Protocol, @TimeoutMs, @RetryCount, @IsActive, @Manufacturer, @AddressOffset)";
        await connection.ExecuteAsync(sql, plc);
        await SetPendingChangesAsync();
    }

    public async Task UpdatePlcAsync(Plc plc)
    {
        using var connection = CreateConnection();
        var sql = @"UPDATE plcs SET name=@Name, ip_address=@IpAddress, port=@Port, 
                    protocol=@Protocol, timeout_ms=@TimeoutMs, retry_count=@RetryCount, is_active=@IsActive, manufacturer=@Manufacturer, address_offset=@AddressOffset 
                    WHERE id=@Id";
        await connection.ExecuteAsync(sql, plc);
        await SetPendingChangesAsync();
    }
    
    public async Task DeletePlcAsync(int id)
    {
        using var connection = CreateConnection();
        await connection.ExecuteAsync("DELETE FROM plcs WHERE id = @Id", new { Id = id });
        await SetPendingChangesAsync();
    }

    // --- Monitoring Table İşlemleri ---
    public async Task<IEnumerable<MonitoringTable>> GetAllTablesAsync()
    {
        using var connection = CreateConnection();
        var sql = @"SELECT t.*, p.name as PlcName FROM monitoring_tables t 
                    LEFT JOIN plcs p ON t.plc_id = p.id 
                    ORDER BY t.id DESC";
        return await connection.QueryAsync<MonitoringTable>(sql);
    }

    public async Task<MonitoringTable?> GetTableByIdAsync(int id)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<MonitoringTable>("SELECT * FROM monitoring_tables WHERE id = @Id", new { Id = id });
    }

    public async Task InsertTableAsync(MonitoringTable table)
    {
        using var connection = CreateConnection();
        var sql = @"INSERT INTO monitoring_tables (name, plc_id, polling_interval_ms, is_active) 
                    VALUES (@Name, @PlcId, @PollingIntervalMs, @IsActive)";
        await connection.ExecuteAsync(sql, table);
        await SetPendingChangesAsync();
    }

    public async Task UpdateTableAsync(MonitoringTable table)
    {
        using var connection = CreateConnection();
        var sql = @"UPDATE monitoring_tables SET name=@Name, plc_id=@PlcId, 
                    polling_interval_ms=@PollingIntervalMs, is_active=@IsActive 
                    WHERE id=@Id";
        await connection.ExecuteAsync(sql, table);
        await SetPendingChangesAsync();
    }

    public async Task DeleteTableAsync(int id)
    {
        using var connection = CreateConnection();
        await connection.ExecuteAsync("DELETE FROM monitoring_tables WHERE id = @Id", new { Id = id });
        await SetPendingChangesAsync();
    }

    // --- Tag İşlemleri ---
    public async Task<IEnumerable<Tag>> GetTagsByTableIdAsync(int tableId)
    {
        using var connection = CreateConnection();
        var sql = "SELECT * FROM tags WHERE monitoring_table_id = @TableId ORDER BY id DESC";
        return await connection.QueryAsync<Tag>(sql, new { TableId = tableId });
    }
    
    public async Task<Tag?> GetTagByIdAsync(int id)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<Tag>("SELECT * FROM tags WHERE id = @Id", new { Id = id });
    }

    public async Task InsertTagAsync(Tag tag)
    {
        using var connection = CreateConnection();
        var sql = @"INSERT INTO tags (monitoring_table_id, name, plc_address, data_type, unit, description, is_active) 
                    VALUES (@MonitoringTableId, @Name, @PlcAddress, @DataType, @Unit, @Description, @IsActive)";
        await connection.ExecuteAsync(sql, tag);
        await SetPendingChangesAsync();
    }
    
    public async Task UpdateTagAsync(Tag tag)
    {
        using var connection = CreateConnection();
        var sql = @"UPDATE tags SET monitoring_table_id=@MonitoringTableId, name=@Name, plc_address=@PlcAddress, 
                    data_type=@DataType, unit=@Unit, description=@Description, is_active=@IsActive 
                    WHERE id=@Id";
        await connection.ExecuteAsync(sql, tag);
        await SetPendingChangesAsync();
    }

    public async Task DeleteTagAsync(int id)
    {
        using var connection = CreateConnection();
        await connection.ExecuteAsync("DELETE FROM tags WHERE id = @Id", new { Id = id });
        await SetPendingChangesAsync();
    }

    // --- Ölçüm (Measurement) İşlemleri ---
    public async Task<IEnumerable<MeasurementDto>> GetRecentMeasurementsAsync(int count = 100, int? tagId = null)
    {
        using var connection = CreateConnection();
        var sql = @"
            SELECT 
                m.timestamp as Timestamp, 
                m.value as Value, 
                t.name as TagName, 
                t.unit as Unit, 
                mt.name as TableName, 
                p.name as PlcName
            FROM measurements m
            INNER JOIN tags t ON m.tag_id = t.id
            INNER JOIN monitoring_tables mt ON t.monitoring_table_id = mt.id
            INNER JOIN plcs p ON mt.plc_id = p.id
            WHERE 1=1";
        
        var parameters = new DynamicParameters();
        if (tagId.HasValue)
        {
            sql += " AND m.tag_id = @TagId";
            parameters.Add("TagId", tagId.Value);
        }

        sql += " ORDER BY m.timestamp DESC LIMIT @Count";
        parameters.Add("Count", count);
        
        return await connection.QueryAsync<MeasurementDto>(sql, parameters);
    }

    // --- Dashboard İşlemleri ---
    public async Task<IEnumerable<DashboardPlcDto>> GetDashboardPlcsAsync()
    {
        using var connection = CreateConnection();
        var sql = @"
            SELECT 
                p.id, p.name, p.ip_address as IpAddress, p.port, p.protocol,
                p.is_active as IsActive,
                (SELECT COUNT(*) FROM monitoring_tables mt WHERE mt.plc_id = p.id) AS TableCount,
                (SELECT COUNT(*) FROM tags t JOIN monitoring_tables mt2 ON t.monitoring_table_id = mt2.id WHERE mt2.plc_id = p.id) AS TagCount,
                (SELECT COUNT(*) FROM system_logs sl WHERE sl.plc_id = p.id AND sl.level = 'ERROR' AND sl.created_at > NOW() - INTERVAL '24 hours') AS RecentErrorCount
            FROM plcs p
            ORDER BY p.name";
        return await connection.QueryAsync<DashboardPlcDto>(sql);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync()
    {
        using var connection = CreateConnection();
        var sql = @"
            SELECT 
                (SELECT COUNT(*) FROM plcs) AS TotalPlcs,
                (SELECT COUNT(*) FROM plcs WHERE is_active = true) AS ActivePlcs,
                (SELECT COUNT(*) FROM monitoring_tables) AS TotalTables,
                (SELECT COUNT(*) FROM tags) AS TotalTags,
                (SELECT COUNT(*) FROM system_logs WHERE level = 'ERROR' AND created_at > NOW() - INTERVAL '24 hours') AS ErrorsLast24h,
                (SELECT COUNT(*) FROM system_logs WHERE level = 'WARNING' AND created_at > NOW() - INTERVAL '24 hours') AS WarningsLast24h";
        return await connection.QueryFirstAsync<DashboardStatsDto>(sql);
    }

    public async Task<IEnumerable<SystemLogDto>> GetRecentLogsAsync(
        int page = 1,
        int pageSize = 50, 
        string? level = null, 
        int? plcId = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null)
    {
        using var connection = CreateConnection();
        var sql = @"
            SELECT l.*, p.name as PlcName
            FROM system_logs l
            LEFT JOIN plcs p ON l.plc_id = p.id
            WHERE 1=1";

        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(level))
        {
            sql += " AND l.level = @Level";
            parameters.Add("Level", level);
        }

        if (plcId.HasValue)
        {
            sql += " AND l.plc_id = @PlcId";
            parameters.Add("PlcId", plcId);
        }

        if (startDate.HasValue)
        {
            sql += " AND l.created_at >= @StartDate";
            parameters.Add("StartDate", startDate.Value);
        }

        if (endDate.HasValue)
        {
            sql += " AND l.created_at <= @EndDate";
            parameters.Add("EndDate", endDate.Value);
        }

        sql += " ORDER BY l.created_at DESC LIMIT @Limit OFFSET @Offset";
        parameters.Add("Limit", pageSize);
        parameters.Add("Offset", (page - 1) * pageSize);

        return await connection.QueryAsync<SystemLogDto>(sql, parameters);
    }

    public async Task<int> GetRecentLogsCountAsync(
        string? level = null, 
        int? plcId = null, 
        DateTime? startDate = null, 
        DateTime? endDate = null)
    {
        using var connection = CreateConnection();
        var sql = "SELECT COUNT(*) FROM system_logs l WHERE 1=1";
        
        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(level))
        {
            sql += " AND l.level = @Level";
            parameters.Add("Level", level);
        }

        if (plcId.HasValue)
        {
            sql += " AND l.plc_id = @PlcId";
            parameters.Add("PlcId", plcId);
        }

        if (startDate.HasValue)
        {
            sql += " AND l.created_at >= @StartDate";
            parameters.Add("StartDate", startDate.Value);
        }

        if (endDate.HasValue)
        {
            sql += " AND l.created_at <= @EndDate";
            parameters.Add("EndDate", endDate.Value);
        }

        return await connection.ExecuteScalarAsync<int>(sql, parameters);
    }

    public async Task ClearAllLogsAsync()
    {
        using var connection = CreateConnection();
        await connection.ExecuteAsync("TRUNCATE TABLE system_logs");
    }

    public async Task<IEnumerable<Tag>> GetAllTagsAsync()
    {
        using var connection = CreateConnection();
        return await connection.QueryAsync<Tag>("SELECT * FROM tags ORDER BY name");
    }

    // --- Kullanıcı İşlemleri ---
    public async Task<User?> GetUserByUsernameAsync(string username)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<User>(
            "SELECT * FROM users WHERE username = @Username", new { Username = username });
    }

    public async Task<User?> GetUserByIdAsync(int id)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<User>(
            "SELECT * FROM users WHERE id = @Id", new { Id = id });
    }

    public async Task<User?> ValidateUserAsync(string username, string password)
    {
        using var connection = CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<User>(
            "SELECT * FROM users WHERE username = @Username AND password_hash = @Password AND is_active = true",
            new { Username = username, Password = password });
    }

    public async Task<bool> UpdateUserPasswordAsync(int userId, string newPassword)
    {
        using var connection = CreateConnection();
        var rows = await connection.ExecuteAsync(
            "UPDATE users SET password_hash = @Password WHERE id = @Id",
            new { Password = newPassword, Id = userId });
        return rows > 0;
    }

    // --- Collector Signaling ---
    public async Task<bool> HasPendingChangesAsync()
    {
        using var connection = CreateConnection();
        return await connection.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM collector_signals WHERE signal_type = 'PENDING' AND is_processed = false)");
    }

    public async Task SetPendingChangesAsync()
    {
        using var connection = CreateConnection();
        // Sadece bir tane PENDING olması yeterli
        var exists = await HasPendingChangesAsync();
        if (!exists)
        {
            await connection.ExecuteAsync(
                "INSERT INTO collector_signals (signal_type) VALUES ('PENDING')");
        }
    }

    public async Task RequestCollectorReloadAsync()
    {
        using var connection = CreateConnection();
        // RELOAD sinyali gönder
        await connection.ExecuteAsync(
            "INSERT INTO collector_signals (signal_type) VALUES ('RELOAD')");
        
        // Tüm PENDING sinyallerini işlemiş say
        await connection.ExecuteAsync(
            "UPDATE collector_signals SET is_processed = true WHERE signal_type = 'PENDING'");
    }
}
