using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NModbus;
using System.Net.Sockets;

namespace IndustrialDataManagement.Pages.Plcs;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<Plc> Plcs { get; set; } = Enumerable.Empty<Plc>();

    public async Task OnGetAsync()
    {
        Plcs = await _db.GetAllPlcsAsync();
    }

    [IgnoreAntiforgeryToken(Order = 1001)]
    public async Task<IActionResult> OnPostTestConnectionAsync(string ipAddress, int port)
    {
        try
        {
            using var tcpClient = new TcpClient();
            var connectTask = tcpClient.ConnectAsync(ipAddress, port);
            
            // max 3 saniye bekle
            if (await Task.WhenAny(connectTask, Task.Delay(3000)) == connectTask)
            {
                if (tcpClient.Connected)
                {
                    // Ekstra modbus doğrulama istenirse:
                    // var factory = new ModbusFactory();
                    // var master = factory.CreateMaster(tcpClient);
                    return new JsonResult(new { success = true });
                }
            }
            return new JsonResult(new { success = false, message = "Zaman aşımı veya bağlantı reddedildi." });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }
}
