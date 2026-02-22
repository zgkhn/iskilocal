using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Plcs;

public class EditModel : PageModel
{
    private readonly AppDbContext _db;

    public EditModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public Plc Plc { get; set; } = default!;

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var plc = await _db.GetPlcByIdAsync(id);
        if (plc == null)
        {
            return NotFound();
        }
        Plc = plc;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        await _db.UpdatePlcAsync(Plc);
        return RedirectToPage("./Index");
    }
}
