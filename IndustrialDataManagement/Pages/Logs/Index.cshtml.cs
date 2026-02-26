using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Logs;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<SystemLogDto> Logs { get; set; } = Enumerable.Empty<SystemLogDto>();
    public IEnumerable<Plc> Plcs { get; set; } = Enumerable.Empty<Plc>();

    [BindProperty(SupportsGet = true)]
    public string? Level { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? PlcId { get; set; }

    [BindProperty(SupportsGet = true)]
    public DateTime? StartDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public DateTime? EndDate { get; set; }

    [BindProperty(SupportsGet = true)]
    public int CurrentPage { get; set; } = 1;

    public int PageSize { get; set; } = 50;
    public int TotalPages { get; set; }
    public int TotalCount { get; set; }

    public async Task OnGetAsync()
    {
        if (CurrentPage < 1) CurrentPage = 1;

        Plcs = await _db.GetAllPlcsAsync();
        TotalCount = await _db.GetRecentLogsCountAsync(Level, PlcId, StartDate, EndDate);
        TotalPages = (int)Math.Ceiling(TotalCount / (double)PageSize);
        
        Logs = await _db.GetRecentLogsAsync(CurrentPage, PageSize, Level, PlcId, StartDate, EndDate);
    }

    public async Task<IActionResult> OnPostClearLogsAsync(string password)
    {
        // Önemli: Gerçek bir sistemde şifre hash'lenmiş olmalı. 
        // Burada basitlik için doğrudan kontrol ediyoruz.
        if (password == "123456")
        {
            await _db.ClearAllLogsAsync();
            TempData["SuccessMessage"] = "Tüm sistem logları başarıyla silindi.";
            return RedirectToPage();
        }

        TempData["ErrorMessage"] = "Hatalı şifre! Loglar silinmedi.";
        return RedirectToPage();
    }
}
