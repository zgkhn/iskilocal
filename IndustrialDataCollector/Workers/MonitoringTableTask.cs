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

        var stopwatch = new Stopwatch();

        while (!cancellationToken.IsCancellationRequested)
        {
            stopwatch.Restart();
            
            try
            {
                var commonTimestamp = DateTime.UtcNow;
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
                    _logger.LogInformation("Table {TableName} [{PlcName}]: Inserted {Count} tags successfully in {Elapsed}ms",
                        _table.Name, _table.Plc.Name, values.Count, stopwatch.ElapsedMilliseconds);

                    // Eksik tagleri tespit et ve logla (Eğer hepsi okunmadıysa)
                    if (values.Count < _tags.Count())
                    {
                        foreach (var tag in _tags)
                        {
                            if (!values.ContainsKey(tag.Id))
                            {
                                var tagMsg = $"{_table.Plc.Name} cihazındaki '{tag.Name}' ({tag.PlcAddress}) tagi okunamadı. Lütfen adresin doğruluğunu ve cihaz konfigürasyonunu kontrol edin.";
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
                    var msg = $"{_table.Plc.Name} cihazından veri gelmedi. PLC'nin çalışır durumda olduğunu ve Tag adreslerinin ({_table.Name}) doğruluğunu kontrol edin.";
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
                var userFriendlyMsg = $"{_table.Plc.Name} ({_table.Plc.IpAddress}) ile iletişim kurulamıyor veya bir hata oluştu. Lütfen ağ bağlantısını ve cihazın açık olduğunu kontrol edin.";
                _logger.LogError(ex, "Table {TableName} [{PlcName}]: {Message}", _table.Name, _table.Plc.Name, userFriendlyMsg);
                await _repository.InsertSystemLogAsync(new SystemLog
                {
                    Level = "ERROR",
                    Message = userFriendlyMsg,
                    Exception = ex.Message, // Teknik detay exception alanında kalsın
                    PlcId = _table.PlcId
                });
            }

            var delayTime = _table.PollingIntervalMs - (int)stopwatch.ElapsedMilliseconds;
            if (delayTime > 0)
            {
                await Task.Delay(delayTime, cancellationToken);
            }
        }
    }
}
