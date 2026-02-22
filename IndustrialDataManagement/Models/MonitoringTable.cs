namespace IndustrialDataManagement.Models;

public class MonitoringTable
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int PlcId { get; set; }
    public int PollingIntervalMs { get; set; } = 1000;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    
    // İlişkisel veri (UI Listeleme için)
    public string? PlcName { get; set; }
}
