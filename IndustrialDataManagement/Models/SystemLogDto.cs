namespace IndustrialDataManagement.Models;

public class SystemLogDto
{
    public int Id { get; set; }
    public string Level { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public string? PlcName { get; set; }
    public DateTime CreatedAt { get; set; }
}
