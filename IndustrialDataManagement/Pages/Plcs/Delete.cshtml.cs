using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Plcs;

public class DeleteModel : PageModel
{
    private readonly AppDbContext _db;

    public DeleteModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public Plc? PlcToDelete { get; set; }

    public async Task<IActionResult> OnGetAsync(int id)
    {
        PlcToDelete = await _db.GetPlcByIdAsync(id);
        if (PlcToDelete == null) return NotFound();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(int id)
    {
        await _db.DeletePlcAsync(id);
        return RedirectToPage("./Index");
    }
}
