using IndustrialDataManagement.Data;
using IndustrialDataManagement.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Linq;

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
            var tag = await _db.GetTagByIdAsync(tagId);
            if (tag == null) return new JsonResult(new { success = false, message = "Tag bulunamadı." });

            var table = await _db.GetTableByIdAsync(tag.MonitoringTableId);
            if (table == null) return new JsonResult(new { success = false, message = "Monitoring tablosu bulunamadı." });

            var plc = await _db.GetPlcByIdAsync(table.PlcId);
            if (plc == null) return new JsonResult(new { success = false, message = "PLC bulunamadı." });

            var result = await ReadModbusValueInternalAsync(plc, tag.PlcAddress, tag.DataType);
            return new JsonResult(new { success = true, value = result, unit = tag.Unit });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }

    [IgnoreAntiforgeryToken(Order = 1001)]
    public async Task<IActionResult> OnPostTestTagValueAsync(int plcId, string address, string dataType)
    {
        try
        {
            var plc = await _db.GetPlcByIdAsync(plcId);
            if (plc == null) return new JsonResult(new { success = false, message = "PLC bulunamadı." });

            if (string.IsNullOrWhiteSpace(address)) 
                return new JsonResult(new { success = false, message = "Lütfen bir adres giriniz." });

            var result = await ReadModbusValueInternalAsync(plc, address, dataType);
            return new JsonResult(new { success = true, value = result });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }

    private async Task<double> ReadModbusValueInternalAsync(Plc plc, string addrStr, string dataType)
    {
        ushort address = 0;
        string region = "HoldingRegisters"; 
        int bitOffset = -1;
        string trimAddr = addrStr.Trim().ToUpperInvariant();

        // 1. Adres Ayrıştırma
        if (string.IsNullOrWhiteSpace(addrStr)) throw new Exception("Adres boş olamaz.");
        if (trimAddr.StartsWith("%")) trimAddr = trimAddr.Substring(1);

        int dotIndex = trimAddr.IndexOf('.');
        if (dotIndex > 0)
        {
            if (int.TryParse(trimAddr.Substring(dotIndex + 1), out int b))
            {
                bitOffset = b;
            }
            trimAddr = trimAddr.Substring(0, dotIndex);
        }

        string manufacturer = plc.Manufacturer ?? "Generic";

        // --- MARKA BAZLI ADRES ÇÖZÜMLEME ---
        bool parsed = false;

        if (manufacturer == "GE Fanuc")
        {
            if (trimAddr.StartsWith("R") || trimAddr.StartsWith("MW") || trimAddr.StartsWith("W"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "HoldingRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("AI"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "InputRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("I") && !trimAddr.StartsWith("IW") && !trimAddr.StartsWith("ID"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "DiscreteInputs";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("Q") && !trimAddr.StartsWith("QW") && !trimAddr.StartsWith("QD"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "Coils";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("M") || trimAddr.StartsWith("T") || trimAddr.StartsWith("G") || trimAddr.StartsWith("S"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    int offset = 0;
                    if (trimAddr.StartsWith("SC")) offset = 384;
                    else if (trimAddr.StartsWith("SB")) offset = 256;
                    else if (trimAddr.StartsWith("SA")) offset = 128;
                    else if (trimAddr.StartsWith("S")) offset = 0;
                    else offset = 0; 
                    
                    address = (ushort)(offset + (addr > 0 ? addr - 1 : 0));
                    region = "DiscreteInputs"; 
                    parsed = true;
                }
            }
        }

        // --- SCHNEIDER ÖZEL HARİTALAMA (0-BASE) ---
        if (manufacturer == "Schneider")
        {
            if (trimAddr.StartsWith("MW") || trimAddr.StartsWith("R"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr; // 0-based
                    region = "HoldingRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("IW") || trimAddr.StartsWith("AI"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "InputRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("Q") || trimAddr.StartsWith("M"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "Coils";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("I"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "DiscreteInputs";
                    parsed = true;
                }
            }
        }

        if (!parsed) // Generic veya diğerleri
        {
            if (trimAddr.StartsWith("MW") || trimAddr.StartsWith("MD") || trimAddr.StartsWith("MF") || 
                trimAddr.StartsWith("ML") || trimAddr.StartsWith("QW") || trimAddr.StartsWith("QD") || 
                trimAddr.StartsWith("R") || trimAddr.StartsWith("AQ"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "HoldingRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("IW") || trimAddr.StartsWith("ID") || trimAddr.StartsWith("AI"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "InputRegisters";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("Q") || trimAddr.StartsWith("M"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "Coils";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("I") || trimAddr.StartsWith("S"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "DiscreteInputs";
                    parsed = true;
                }
            }
            else if (trimAddr.StartsWith("4") && trimAddr.Length >= 5)
            {
                address = (ushort)(int.Parse(trimAddr) - 40001);
                region = "HoldingRegisters";
                parsed = true;
            }
            else if (trimAddr.StartsWith("3") && trimAddr.Length >= 5)
            {
                address = (ushort)(int.Parse(trimAddr) - 30001);
                region = "InputRegisters";
                parsed = true;
            }
            else if (trimAddr.StartsWith("1") && trimAddr.Length >= 5)
            {
                address = (ushort)(int.Parse(trimAddr) - 10001);
                region = "DiscreteInputs";
                parsed = true;
            }
            else if (trimAddr.StartsWith("0") && trimAddr.Length >= 5)
            {
                address = (ushort)(int.Parse(trimAddr) - 1);
                region = "Coils";
                parsed = true;
            }
            else if (ushort.TryParse(trimAddr, out var rawAddress))
            {
                address = rawAddress;
                region = "HoldingRegisters";
                parsed = true;
            }
        }

        if (!parsed) throw new Exception("PLC adresi tanınamadı veya bu marka için geçersiz. (Örn: %MW300, %MW200.7 %Q10, %I5, 40001)");
        
        // PLC bazlı ofseti uygula
        int finalAddress = address + plc.AddressOffset;
        address = (ushort)(finalAddress < 0 ? 0 : finalAddress);

        // 2. Modbus Bağlantısı
        using var tcpClient = new System.Net.Sockets.TcpClient();
        var connectTask = tcpClient.ConnectAsync(plc.IpAddress, plc.Port);
        if (await Task.WhenAny(connectTask, Task.Delay(plc.TimeoutMs)) != connectTask || !tcpClient.Connected)
            throw new Exception("PLC'ye bağlanılamadı. IP ve Portu kontrol ediniz.");

        var factory = new NModbus.ModbusFactory();
        var master = factory.CreateMaster(tcpClient);
        master.Transport.ReadTimeout = plc.TimeoutMs;

        byte slaveId = 1; 
        string dt = dataType?.ToLower() ?? "int";
        ushort length = (dt == "float" || dt == "real" || dt == "dint" || dt == "dword" || dt == "uint32" || dt == "int32" || dt == "udint") ? (ushort)2 : (ushort)1;

        if (region == "Coils" || region == "DiscreteInputs")
        {
            bool[] bitData = region == "DiscreteInputs" 
                ? await master.ReadInputsAsync(slaveId, address, 1) 
                : await master.ReadCoilsAsync(slaveId, address, 1);
            return bitData != null && bitData.Length > 0 && bitData[0] ? 1.0 : 0.0;
        }
        else
        {
            ushort[] data = region == "InputRegisters"
                ? await master.ReadInputRegistersAsync(slaveId, address, length)
                : await master.ReadHoldingRegistersAsync(slaveId, address, length);

            if (bitOffset >= 0 && data.Length > 0)
            {
                // Schneider bit.7 means index 7 (direct 0-based bit index)
                bool isSet = (data[0] & (1 << bitOffset)) != 0;
                return isSet ? 1.0 : 0.0;
            }

            switch (dt)
            {
                case "float":
                case "real":
                    byte[] fBytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    BitConverter.GetBytes(data[0]).CopyTo(fBytes, 0); 
                    BitConverter.GetBytes(data[1]).CopyTo(fBytes, 2);
                    return Math.Round(BitConverter.ToSingle(fBytes, 0), 2);
                case "dint":
                case "int32":
                    byte[] diBytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    BitConverter.GetBytes(data[0]).CopyTo(diBytes, 0); 
                    BitConverter.GetBytes(data[1]).CopyTo(diBytes, 2);
                    return BitConverter.ToInt32(diBytes, 0);
                case "dword":
                case "uint32":
                case "udint":
                    byte[] udBytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    BitConverter.GetBytes(data[0]).CopyTo(udBytes, 0); 
                    BitConverter.GetBytes(data[1]).CopyTo(udBytes, 2);
                    return BitConverter.ToUInt32(udBytes, 0);
                case "uint":
                case "uint16":
                case "word":
                    return data[0];
                case "bool":
                case "boolean":
                    return data[0] > 0 ? 1.0 : 0.0;
                default:
                    return (short)data[0];
            }
        }
    }
}
