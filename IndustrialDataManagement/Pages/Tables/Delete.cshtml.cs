using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tables;

public class DeleteModel : PageModel
{
    private readonly AppDbContext _db;

    public DeleteModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public MonitoringTable? TableToDelete { get; set; }

    public async Task<IActionResult> OnGetAsync(int id)
    {
        TableToDelete = await _db.GetTableByIdAsync(id);
        if (TableToDelete == null) return NotFound();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(int id)
    {
        await _db.DeleteTableAsync(id);
        return RedirectToPage("./Index");
    }
}
