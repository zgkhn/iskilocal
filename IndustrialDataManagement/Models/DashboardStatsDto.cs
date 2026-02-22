namespace IndustrialDataManagement.Models;

public class DashboardStatsDto
{
    public int TotalPlcs { get; set; }
    public int ActivePlcs { get; set; }
    public int TotalTables { get; set; }
    public int TotalTags { get; set; }
    public int ErrorsLast24h { get; set; }
    public int WarningsLast24h { get; set; }
}
