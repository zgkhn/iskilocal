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

    public void OnGet(int tableId)
    {
        Tag.MonitoringTableId = tableId;
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        await _db.InsertTagAsync(Tag);
        return RedirectToPage("./Index", new { tableId = Tag.MonitoringTableId });
    }
}
