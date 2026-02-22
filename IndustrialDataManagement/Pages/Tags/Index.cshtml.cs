using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IndustrialDataManagement.Pages.Tags;

public class IndexModel : PageModel
{
    private readonly AppDbContext _db;

    public IndexModel(AppDbContext db)
    {
        _db = db;
    }

    public IEnumerable<Tag> Tags { get; set; } = Enumerable.Empty<Tag>();

    [BindProperty(SupportsGet = true)]
    public int? TableId { get; set; }

    public async Task OnGetAsync()
    {
        if (TableId.HasValue)
        {
            Tags = await _db.GetTagsByTableIdAsync(TableId.Value);
        }
    }

    [IgnoreAntiforgeryToken(Order = 1001)]
    public async Task<IActionResult> OnPostReadTagValueAsync(int tagId)
    {
        try
        {
            // 1. Tag bilgisini ve bağlı olduğu donanımları db'den bul
            var tag = await _db.GetTagByIdAsync(tagId);
            if (tag == null) return new JsonResult(new { success = false, message = "Tag bulunamadı." });

            var table = await _db.GetTableByIdAsync(tag.MonitoringTableId);
            if (table == null) return new JsonResult(new { success = false, message = "Monitoring tablosu bulunamadı." });

            var plc = await _db.GetPlcByIdAsync(table.PlcId);
            if (plc == null) return new JsonResult(new { success = false, message = "PLC bulunamadı." });

            ushort address = 0;
            string addrStr = tag.PlcAddress?.Trim() ?? string.Empty;
            bool isInputReg = false;

            if (addrStr.StartsWith("4") && addrStr.Length == 5)
            {
                address = (ushort)(int.Parse(addrStr) - 40001);
            }
            else if (addrStr.StartsWith("3") && addrStr.Length == 5)
            {
                address = (ushort)(int.Parse(addrStr) - 30001);
                isInputReg = true;
            }
            else if (ushort.TryParse(addrStr, out var rawAddress))
            {
                // Kullanıcı direkt olarak 0, 10, 96 gibi bir ofset adresi girmişse
                address = rawAddress;
            }
            else
            {
                return new JsonResult(new { success = false, message = "PLC adresi sayısal kurala uygun değil (Örn: 40001, 30010 veya ofset 0, 10)." });
            }

            // 2. PLC'ye bağlan
            using var tcpClient = new System.Net.Sockets.TcpClient();
            var connectTask = tcpClient.ConnectAsync(plc.IpAddress, plc.Port);
            if (await Task.WhenAny(connectTask, Task.Delay(plc.TimeoutMs)) != connectTask || !tcpClient.Connected)
            {
                return new JsonResult(new { success = false, message = "PLC'ye bağlanılamadı. IP ve Portu kontrol ediniz." });
            }

            // 3. Modbus üzerinden oku
            var factory = new NModbus.ModbusFactory();
            var master = factory.CreateMaster(tcpClient);
            master.Transport.ReadTimeout = plc.TimeoutMs;

            ushort[] data;
            byte slaveId = 1; // Genellikle 1 kullanılır
            ushort length = (tag.DataType?.ToLower() == "float" || tag.DataType?.ToLower() == "real") ? (ushort)2 : (ushort)1;

            if (isInputReg)
            {
                data = await master.ReadInputRegistersAsync(slaveId, address, length);
            }
            else
            {
                data = await master.ReadHoldingRegistersAsync(slaveId, address, length);
            }

            // 4. Veri dönüşümü
            double value = 0;
            if (tag.DataType?.ToLower() == "float" || tag.DataType?.ToLower() == "real")
            {
                byte[] bytes = new byte[4];
                // Word Swap (En yaygın Modbus 32-bit okuma formatı)
                BitConverter.GetBytes(data[1]).CopyTo(bytes, 0); 
                BitConverter.GetBytes(data[0]).CopyTo(bytes, 2);
                value = Math.Round(BitConverter.ToSingle(bytes, 0), 2); // Küsuratı 2 haneye yuvarla
            }
            else if (tag.DataType?.ToLower() == "bool")
            {
                value = data[0] > 0 ? 1.0 : 0.0;
            }
            else
            {
                // Standart integer (16-bit signed)
                value = (short)data[0];
            }

            return new JsonResult(new { success = true, value = value, unit = tag.Unit });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }
}
