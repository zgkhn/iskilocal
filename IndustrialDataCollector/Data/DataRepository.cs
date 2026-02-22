using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using IndustrialDataCollector.Entities;
using IndustrialDataCollector.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace IndustrialDataCollector.Data;

public class DataRepository : IDataRepository
{
    private readonly string _connectionString;
    private readonly ILogger<DataRepository> _logger;

    public DataRepository(IConfiguration configuration, ILogger<DataRepository> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
                            ?? throw new ArgumentNullException("Connection string is missing.");
        _logger = logger;
    }

    public async Task<IEnumerable<MonitoringTable>> GetActiveMonitoringTablesAsync()
    {
        const string sql = @"
            SELECT mt.*, 
                   p.id, p.name, p.ip_address, p.port, p.protocol, p.timeout_ms, p.retry_count, p.is_active
            FROM monitoring_tables mt
            INNER JOIN plcs p ON mt.plc_id = p.id
            WHERE mt.is_active = true AND p.is_active = true;";

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        var tables = await connection.QueryAsync<MonitoringTable, Plc, MonitoringTable>(
            sql,
            (table, plc) =>
            {
                table.Plc = plc;
                plc.Id = table.PlcId; 
                return table;
            },
            splitOn: "id"
        );

        return tables;
    }

    public async Task<IEnumerable<Tag>> GetActiveTagsByTableIdAsync(int tableId)
    {
        const string sql = @"
            SELECT * FROM tags 
            WHERE monitoring_table_id = @TableId AND is_active = true;";

        using var connection = new NpgsqlConnection(_connectionString);
        return await connection.QueryAsync<Tag>(sql, new { TableId = tableId });
    }

    public async Task InsertMeasurementsBatchAsync(IEnumerable<Measurement> measurements, CancellationToken cancellationToken = default)
    {
        if (measurements == null || !measurements.Any()) return;

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // Binary importer is the fastest way to insert bulk data into PostgreSQL
            using (var writer = await connection.BeginBinaryImportAsync("COPY measurements (tag_id, timestamp, value) FROM STDIN (FORMAT BINARY)", cancellationToken))
            {
                foreach (var measurement in measurements)
                {
                    await writer.StartRowAsync(cancellationToken);
                    await writer.WriteAsync(measurement.TagId, NpgsqlTypes.NpgsqlDbType.Integer, cancellationToken);
                    
                    // Veritabanı timezone timestamptz olduğu için DateTime UTC olarak gönderilmeli
                    await writer.WriteAsync(measurement.Timestamp.ToUniversalTime(), NpgsqlTypes.NpgsqlDbType.TimestampTz, cancellationToken);
                    
                    await writer.WriteAsync(measurement.Value, NpgsqlTypes.NpgsqlDbType.Double, cancellationToken);
                }
                await writer.CompleteAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Batch insert işlemi sırasında hata oluştu.");
            throw;
        }
    }

    public async Task EnsurePartitionsExistAsync()
    {
        // Örnek: Şu anki ve gelecek ayı otomatik oluşturan basit bir mantık
        var now = DateTime.UtcNow;
        var months = new[] { now, now.AddMonths(1) };

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        foreach (var date in months)
        {
            var tableName = $"measurements_y{date.Year}m{date.Month:00}";
            var startDate = new DateTime(date.Year, date.Month, 1).ToString("yyyy-MM-01");
            var endDate = new DateTime(date.Year, date.Month, 1).AddMonths(1).ToString("yyyy-MM-01");

            var sql = $@"
                CREATE TABLE IF NOT EXISTS {tableName} 
                PARTITION OF measurements 
                FOR VALUES FROM ('{startDate}') TO ('{endDate}');";
            
            await connection.ExecuteAsync(sql);
        }

        // system_logs tablosunu da kontrol et/oluştur
        var logTableSql = @"
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                level VARCHAR(20) NOT NULL,
                message TEXT NOT NULL,
                exception TEXT,
                plc_id INTEGER REFERENCES plcs(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );";
        await connection.ExecuteAsync(logTableSql);
    }

    public async Task InsertSystemLogAsync(SystemLog log)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        var sql = @"
            INSERT INTO system_logs (level, message, exception, plc_id, created_at)
            VALUES (@Level, @Message, @Exception, @PlcId, CURRENT_TIMESTAMP);";
        await connection.ExecuteAsync(sql, log);
    }
}
