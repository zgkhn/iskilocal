namespace IndustrialDataManagement.Models;

public class Plc
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 502;
    public string Protocol { get; set; } = "ModbusTCP";
    public int TimeoutMs { get; set; } = 2000;
    public int RetryCount { get; set; } = 3;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
