using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tags;

public class CreateModel : PageModel
{
    private readonly AppDbContext _db;

    public CreateModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public Tag Tag { get; set; } = new Tag();
    public int PlcId { get; set; }

    public async Task OnGetAsync(int tableId)
    {
        Tag.MonitoringTableId = tableId;
        var table = await _db.GetTableByIdAsync(tableId);
        if (table != null) PlcId = table.PlcId;
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        await _db.InsertTagAsync(Tag);
        return RedirectToPage("./Index", new { tableId = Tag.MonitoringTableId });
    }

    [IgnoreAntiforgeryToken(Order = 1001)]
    public async Task<IActionResult> OnPostTestTagValueAsync(int plcId, string address, string dataType)
    {
        // IndexModel'deki mantığı burada da kullanabilmek için Index'e yönlendiriyoruz veya kodu buraya kopyalıyoruz.
        // Şimdilik basitçe IndexModel'den bir instance oluşturmak yerine DB'den PLC'yi çekip testi yapalım.
        try
        {
            var plc = await _db.GetPlcByIdAsync(plcId);
            if (plc == null) return new JsonResult(new { success = false, message = "PLC bulunamadı." });
            
            // Kod tekrarını önlemek için merkezi bir yere taşınabilir ama şimdilik hızlı çözüm:
            // IndexModel'deki ReadModbusValueInternalAsync statik değil, bu yüzden DB'den manuel ReadModbusValueInternalAsync (benzerini) yapıyoruz.
            // Alternatif: Ortak bir Helper sınıfı.
            
            // Şimdilik Index sayfasındaki handler'ı çalğırmayı JS tarafında ayarlayacağız (Index?handler=TestTagValue).
            // Dolayısıyla buraya eklemeye gerek olmayabilir. JS'den direkt Index'teki handler'a POST atacağız.
            return new JsonResult(new { success = false, message = "Dahili test handler'ı kullanılmıyor. Lütfen JS rotasını kontrol edin." });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }
}
