using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using IndustrialDataCollector.Entities;

namespace IndustrialDataCollector.Interfaces;

public interface IDataRepository
{
    Task<IEnumerable<MonitoringTable>> GetActiveMonitoringTablesAsync();
    Task<IEnumerable<Tag>> GetActiveTagsByTableIdAsync(int tableId);
    Task InsertMeasurementsBatchAsync(IEnumerable<Measurement> measurements, CancellationToken cancellationToken = default);
    Task EnsurePartitionsExistAsync();
    Task InsertSystemLogAsync(SystemLog log);
    Task<bool> HasPendingReloadSignalAsync();
    Task MarkReloadSignalsAsProcessedAsync();
}
