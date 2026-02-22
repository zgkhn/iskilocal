using System.Security.Claims;
using IndustrialDataManagement.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Account;

public class LoginModel : PageModel
{
    private readonly AppDbContext _db;

    public LoginModel(AppDbContext db)
    {
        _db = db;
    }

    [BindProperty]
    public string Username { get; set; } = string.Empty;

    [BindProperty]
    public string Password { get; set; } = string.Empty;

    public string? ErrorMessage { get; set; }

    public void OnGet()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            Response.Redirect("/");
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (string.IsNullOrEmpty(Username) || string.IsNullOrEmpty(Password))
        {
            ErrorMessage = "Kullanıcı adı ve şifre gereklidir.";
            return Page();
        }

        var user = await _db.ValidateUserAsync(Username, Password);
        if (user == null)
        {
            ErrorMessage = "Geçersiz kullanıcı adı veya şifre.";
            return Page();
        }

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("FullName", user.Fullname ?? user.Username)
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        var authProperties = new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(24)
        };

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(claimsIdentity),
            authProperties);

        return RedirectToPage("/Index");
    }
}
