using System;

namespace IndustrialDataCollector.Entities;

public class MonitoringTable
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int PlcId { get; set; }
    public int PollingIntervalMs { get; set; } = 1000;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    
    // Yüklenen bağlı yapılandırma
    public Plc Plc { get; set; } = null!;
}
