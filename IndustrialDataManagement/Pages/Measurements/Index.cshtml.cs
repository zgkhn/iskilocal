using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Measurements;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<MeasurementDto> Measurements { get; set; } = Enumerable.Empty<MeasurementDto>();

    public async Task OnGetAsync()
    {
        // Son 200 kaydı getir, veritabanına yüklenmeden hızlıca sonuç sağla
        Measurements = await _db.GetRecentMeasurementsAsync(200);
    }
}
