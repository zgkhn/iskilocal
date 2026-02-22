using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tables;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<MonitoringTable> Tables { get; set; } = Enumerable.Empty<MonitoringTable>();

    public async Task OnGetAsync()
    {
        Tables = await _db.GetAllTablesAsync();
    }
}
