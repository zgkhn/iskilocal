using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tags;

public class EditModel : PageModel
{
    private readonly AppDbContext _db;

    public EditModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public Tag Tag { get; set; } = new Tag();
    public int PlcId { get; set; }

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var tag = await _db.GetTagByIdAsync(id);
        if (tag == null) return NotFound();

        Tag = tag;
        var table = await _db.GetTableByIdAsync(tag.MonitoringTableId);
        if (table != null) PlcId = table.PlcId;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        await _db.UpdateTagAsync(Tag);
        return RedirectToPage("./Index", new { tableId = Tag.MonitoringTableId });
    }
}
