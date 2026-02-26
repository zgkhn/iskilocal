using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
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
    public IEnumerable<Tag> Tags { get; set; } = Enumerable.Empty<Tag>();

    [BindProperty(SupportsGet = true)]
    public int? TagId { get; set; }

    public async Task OnGetAsync()
    {
        Tags = await _db.GetAllTagsAsync();

        // Son 200 kaydı getir, veritabanına yüklenmeden hızlıca sonuç sağla
        Measurements = await _db.GetRecentMeasurementsAsync(200, TagId);
    }
}
