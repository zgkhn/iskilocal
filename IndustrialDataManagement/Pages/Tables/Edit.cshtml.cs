using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace IndustrialDataManagement.Pages.Tables;

public class EditModel : PageModel
{
    private readonly AppDbContext _db;

    public EditModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public MonitoringTable Table { get; set; } = default!;

    public SelectList PlcList { get; set; } = null!;

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var table = await _db.GetTableByIdAsync(id);
        if (table == null)
        {
            return NotFound();
        }
        Table = table;

        var plcs = await _db.GetAllPlcsAsync();
        PlcList = new SelectList(plcs, "Id", "Name");
        
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            var plcs = await _db.GetAllPlcsAsync();
            PlcList = new SelectList(plcs, "Id", "Name");
            return Page();
        }

        await _db.UpdateTableAsync(Table);
        return RedirectToPage("./Index");
    }
}
