using IndustrialDataManagement.Data;
using Dapper;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);

// Ensure Dapper maps snake_case columns (like ip_address) to PascalCase properties (like IpAddress)
DefaultTypeMap.MatchNamesWithUnderscores = true;

// Add services to the container.
builder.Services.AddRazorPages(options =>
{
    options.Conventions.ConfigureFilter(new Microsoft.AspNetCore.Mvc.IgnoreAntiforgeryTokenAttribute());
    
    // Tüm sayfalara varsayılan olarak [Authorize] ekle (Login sayfası hariç tutulacak)
    options.Conventions.AuthorizeFolder("/");
    options.Conventions.AllowAnonymousToPage("/Account/Login");
});

// Authentication ve Cookie Yapılandırması
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.Cookie.Name = "IskiAuthCookie";
        options.ExpireTimeSpan = TimeSpan.FromHours(24);
        options.SlidingExpiration = true;
    });

builder.Services.AddSingleton<AppDbContext>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}
app.UseStaticFiles();

app.UseRouting();

// Önce Authentication, sonra Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();

app.Run();
