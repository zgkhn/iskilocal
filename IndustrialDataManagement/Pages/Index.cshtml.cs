using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<DashboardPlcDto> Plcs { get; set; } = Enumerable.Empty<DashboardPlcDto>();
    public DashboardStatsDto Stats { get; set; } = new();
    public IEnumerable<SystemLogDto> RecentLogs { get; set; } = Enumerable.Empty<SystemLogDto>();

    public async Task OnGetAsync()
    {
        Plcs = await _db.GetDashboardPlcsAsync();
        Stats = await _db.GetDashboardStatsAsync();
        RecentLogs = await _db.GetRecentLogsAsync(1, 5);
    }
}
