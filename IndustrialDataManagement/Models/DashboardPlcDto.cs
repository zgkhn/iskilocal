namespace IndustrialDataManagement.Models;

public class DashboardPlcDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public int Port { get; set; }
    public string Protocol { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int TableCount { get; set; }
    public int TagCount { get; set; }
    public int RecentErrorCount { get; set; }
}
