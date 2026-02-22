namespace IndustrialDataCollector.Entities;

public class SystemLog
{
    public int Id { get; set; }
    public string Level { get; set; } = "INFO";
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public int? PlcId { get; set; }
    public DateTime CreatedAt { get; set; }
}
