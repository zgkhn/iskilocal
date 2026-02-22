namespace IndustrialDataManagement.Models;

public class Tag
{
    public int Id { get; set; }
    public int MonitoringTableId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PlcAddress { get; set; } = string.Empty;
    public string DataType { get; set; } = "float"; // int, float, bool
    public string? Unit { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    
    // İlişkisel veri
    public string? TableName { get; set; }
}
