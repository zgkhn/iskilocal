using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tags;

public class DeleteModel : PageModel
{
    private readonly AppDbContext _db;

    public DeleteModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public Tag? TagToDelete { get; set; }

    public async Task<IActionResult> OnGetAsync(int id)
    {
        TagToDelete = await _db.GetTagByIdAsync(id);
        if (TagToDelete == null) return NotFound();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(int id)
    {
        var tag = await _db.GetTagByIdAsync(id);
        if (tag != null)
        {
            await _db.DeleteTagAsync(id);
            return RedirectToPage("./Index", new { tableId = tag.MonitoringTableId });
        }
        return RedirectToPage("./Index");
    }
}
