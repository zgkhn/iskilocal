using System.Security.Claims;
using IndustrialDataManagement.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Account;

[Authorize]
public class ChangePasswordModel : PageModel
{
    private readonly AppDbContext _db;

    public ChangePasswordModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public string CurrentPassword { get; set; } = string.Empty;

    [BindProperty]
    public string NewPassword { get; set; } = string.Empty;

    [BindProperty]
    public string ConfirmPassword { get; set; } = string.Empty;

    public string? ErrorMessage { get; set; }
    public string? SuccessMessage { get; set; }

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (NewPassword != ConfirmPassword)
        {
            ErrorMessage = "Yeni şifreler uyuşmuyor.";
            return Page();
        }

        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out int userId))
        {
            return RedirectToPage("/Account/Login");
        }

        // Mevcut şifre kontrolü
        var userName = User.Identity?.Name ?? "";
        var user = await _db.ValidateUserAsync(userName, CurrentPassword);
        
        if (user == null)
        {
            ErrorMessage = "Mevcut şifreniz hatalı.";
            return Page();
        }

        var result = await _db.UpdateUserPasswordAsync(userId, NewPassword);
        if (result)
        {
            SuccessMessage = "Şifreniz başarıyla güncellendi.";
        }
        else
        {
            ErrorMessage = "Şifre güncellenirken bir hata oluştu.";
        }

        return Page();
    }
}
