using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace IndustrialDataManagement.Pages.Tables;

public class CreateModel : PageModel
{
    private readonly AppDbContext _db;

    public CreateModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public MonitoringTable Table { get; set; } = new MonitoringTable();

    public SelectList PlcList { get; set; } = null!;

    public async Task OnGetAsync()
    {
        var plcs = await _db.GetAllPlcsAsync();
        PlcList = new SelectList(plcs, "Id", "Name");
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            await OnGetAsync();
            return Page();
        }

        await _db.InsertTableAsync(Table);
        return RedirectToPage("./Index");
    }
}
