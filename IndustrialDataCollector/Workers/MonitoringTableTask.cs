using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using IndustrialDataCollector.Entities;
using IndustrialDataCollector.Interfaces;
using Microsoft.Extensions.Logging;

namespace IndustrialDataCollector.Workers;

public class MonitoringTableTask
{
    private readonly MonitoringTable _table;
    private readonly IEnumerable<Tag> _tags;
    private readonly IPlcDriver _driver;
    private readonly IDataRepository _repository;
    private readonly ILogger _logger;

    public MonitoringTableTask(
        MonitoringTable table, 
        IEnumerable<Tag> tags, 
        IPlcDriver driver, 
        IDataRepository repository,
        ILogger logger)
    {
        _table = table;
        _tags = tags;
        _driver = driver;
        _repository = repository;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Started Scheduler for Table {TableName} (PLC: {PlcName}) with Polling {Interval}ms",
            _table.Name, _table.Plc.Name, _table.PollingIntervalMs);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Hizalı zamanı hesapla (Timestamp rounding)
                var now = DateTime.UtcNow;
                var intervalTicks = _table.PollingIntervalMs * TimeSpan.TicksPerMillisecond;
                var roundedTicks = (now.Ticks / intervalTicks) * intervalTicks;
                var commonTimestamp = new DateTime(roundedTicks, DateTimeKind.Utc);

                var values = await _driver.ReadTagsAsync(_tags);

                if (values != null && values.Count > 0)
                {
                    var measurements = values.Select(kvp => new Measurement
                    {
                        TagId = kvp.Key,
                        Timestamp = commonTimestamp,
                        Value = kvp.Value
                    });

                    await _repository.InsertMeasurementsBatchAsync(measurements, cancellationToken);
                    _logger.LogInformation("Table {TableName} [{PlcName}]: Inserted {Count} tags for {Timestamp}",
                        _table.Name, _table.Plc.Name, values.Count, commonTimestamp.ToString("yyyy-MM-dd HH:mm:ss"));

                    if (values.Count < _tags.Count())
                    {
                        foreach (var tag in _tags)
                        {
                            if (!values.ContainsKey(tag.Id))
                            {
                                var tagMsg = $"{_table.Plc.Name} cihazındaki '{tag.Name}' ({tag.PlcAddress}) tagi okunamadı.";
                                _logger.LogWarning("Table {TableName} [{PlcName}]: {Message}", _table.Name, _table.Plc.Name, tagMsg);
                                await _repository.InsertSystemLogAsync(new SystemLog
                                {
                                    Level = "WARNING",
                                    Message = tagMsg,
                                    PlcId = _table.PlcId
                                });
                            }
                        }
                    }
                }
                else
                {
                    var msg = $"{_table.Plc.Name} cihazından veri gelmedi. PLC bağlantısını kontrol edin.";
                    _logger.LogWarning("Table {TableName} [{PlcName}]: {Message}", _table.Name, _table.Plc.Name, msg);
                    await _repository.InsertSystemLogAsync(new SystemLog
                    {
                        Level = "WARNING",
                        Message = msg,
                        PlcId = _table.PlcId
                    });
                }
            }
            catch (Exception ex)
            {
                var userFriendlyMsg = $"{_table.Plc.Name} iletişim hatası: {ex.Message}";
                _logger.LogError(ex, "Table {TableName} [{PlcName}]: {Message}", _table.Name, _table.Plc.Name, userFriendlyMsg);
            }

            // Bir sonraki tam periyoda kadar bekle (Clock-Aligned Delay)
            var nextTickTicks = ((DateTime.UtcNow.Ticks / (_table.PollingIntervalMs * TimeSpan.TicksPerMillisecond)) + 1) 
                                * (_table.PollingIntervalMs * TimeSpan.TicksPerMillisecond);
            var delayTime = new DateTime(nextTickTicks, DateTimeKind.Utc) - DateTime.UtcNow;

            if (delayTime.TotalMilliseconds > 0)
            {
                await Task.Delay(delayTime, cancellationToken);
            }
        }
    }
}
