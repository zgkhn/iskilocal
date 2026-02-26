using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Sockets;
using System.Threading.Tasks;
using IndustrialDataCollector.Entities;
using IndustrialDataCollector.Interfaces;
using Microsoft.Extensions.Logging;
using NModbus;

namespace IndustrialDataCollector.Drivers;

public class ModbusTcpDriver : IPlcDriver, IDisposable
{
    private readonly Plc _plcConfig;
    private readonly ILogger<ModbusTcpDriver> _logger;
    private TcpClient? _tcpClient;
    private IModbusMaster? _modbusMaster;
    private bool _isConnected;

    public ModbusTcpDriver(Plc plcConfig, ILogger<ModbusTcpDriver> logger)
    {
        _plcConfig = plcConfig;
        _logger = logger;
    }

    public async Task ConnectAsync()
    {
        if (_isConnected) return;

        try
        {
            _tcpClient = new TcpClient();
            
            // Timeout yönetimi
            var connectTask = _tcpClient.ConnectAsync(_plcConfig.IpAddress, _plcConfig.Port);
            if (await Task.WhenAny(connectTask, Task.Delay(_plcConfig.TimeoutMs)) != connectTask)
            {
                throw new TimeoutException($"PLC Modbus TCP connection timeout to {_plcConfig.IpAddress}:{_plcConfig.Port}");
            }

            if (!_tcpClient.Connected)
                throw new Exception("PLC connection failed.");

            var factory = new ModbusFactory();
            _modbusMaster = factory.CreateMaster(_tcpClient);
            _modbusMaster.Transport.ReadTimeout = _plcConfig.TimeoutMs;
            _modbusMaster.Transport.WriteTimeout = _plcConfig.TimeoutMs;
            
            _isConnected = true;
            _logger.LogInformation("Connected to Modbus PLC: {PlcName} ({Ip}:{Port})", _plcConfig.Name, _plcConfig.IpAddress, _plcConfig.Port);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to Modbus PLC: {PlcName}", _plcConfig.Name);
            Disconnect();
            throw;
        }
    }

    public void Disconnect()
    {
        _isConnected = false;
        _modbusMaster?.Dispose();
        _tcpClient?.Dispose();
        _modbusMaster = null;
        _tcpClient = null;
    }

    public bool TestConnection()
    {
        try
        {
            ConnectAsync().Wait();
            return _isConnected;
        }
        catch
        {
            return false;
        }
        finally
        {
            Disconnect();
        }
    }

    public async Task<IDictionary<int, double>> ReadTagsAsync(IEnumerable<Tag> tags)
    {
        var results = new Dictionary<int, double>();
        if (!tags.Any()) return results;

        int retry = 0;
        bool success = false;

        while (retry <= _plcConfig.RetryCount && !success)
        {
            try
            {
                if (!_isConnected || _tcpClient == null || !_tcpClient.Connected)
                {
                    await ConnectAsync();
                }

                if (_modbusMaster == null)
                    throw new InvalidOperationException("Modbus master is not initialized.");

                foreach (var tag in tags)
                {
                    try
                    {
                        if (TryParseAddress(tag.PlcAddress, out ushort address, out string region, out int bitOffset))
                        {
                            // PLC bazlı ofseti uygula
                            int finalAddress = address + _plcConfig.AddressOffset;
                            address = (ushort)(finalAddress < 0 ? 0 : finalAddress);

                            byte slaveId = 1;
                            _logger.LogInformation("Reading Modbus: Slave {SlaveId}, Register {Address}, Region {Region}, Type {DataType}", slaveId, address, region, tag.DataType);
                            
                            // Coils (0x) veya Discrete Inputs (1x)
                            if (region == "Coils" || region == "DiscreteInputs")
                            {
                                // Tek bir bit okuyoruz (Boolean olarak)
                                bool[] bitData = region == "DiscreteInputs" 
                                    ? await _modbusMaster.ReadInputsAsync(slaveId, address, 1) 
                                    : await _modbusMaster.ReadCoilsAsync(slaveId, address, 1);
                                    
                                results[tag.Id] = bitData != null && bitData.Length > 0 && bitData[0] ? 1.0 : 0.0;
                            }
                            // Input Registers (3x) veya Holding Registers (4x)
                            else 
                            {
                                string dt = tag.DataType?.ToLower() ?? "int";
                                ushort length = (dt == "float" || dt == "real" || dt == "dint" || dt == "dword" || dt == "uint32" || dt == "int32" || dt == "udint") ? (ushort)2 : (ushort)1;
                                ushort[] regData;

                                if (region == "InputRegisters")
                                    regData = await _modbusMaster.ReadInputRegistersAsync(slaveId, address, length);
                                else
                                    regData = await _modbusMaster.ReadHoldingRegistersAsync(slaveId, address, length);

                                if (bitOffset >= 0 && regData.Length > 0)
                                {
                                    // Schneider bit.7 means index 7 (direct 0-based bit index)
                                    bool val = (regData[0] & (1 << bitOffset)) != 0;
                                    results[tag.Id] = val ? 1.0 : 0.0;
                                }
                                else
                                {
                                    results[tag.Id] = ConvertDataToDouble(regData, dt);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error reading specific tag {TagName} (Addr: {Address}) from PLC {PlcName}. Skipping this tag.", 
                            tag.Name, tag.PlcAddress, _plcConfig.Name);
                    }
                }
                
                success = true;
            }
            catch (Exception ex)
            {
                retry++;
                _logger.LogWarning(ex, "Error reading from PLC {PlcName}. Retry: {Retry}/{MaxRetry}", _plcConfig.Name, retry, _plcConfig.RetryCount);
                Disconnect();
                
                if (retry > _plcConfig.RetryCount)
                {
                    _logger.LogError(ex, "Failed to read from PLC {PlcName} after {RetryCount} retries.", _plcConfig.Name, _plcConfig.RetryCount);
                    throw; 
                }
                await Task.Delay(1000); 
            }
        }

        return results;
    }

    private bool TryParseAddress(string addressStr, out ushort address, out string region, out int bitOffset)
    {
        address = 0;
        region = "HoldingRegisters"; // Default
        bitOffset = -1;
        if (string.IsNullOrWhiteSpace(addressStr)) return false;

        string trimAddr = addressStr.Trim().ToUpperInvariant();
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

        string manufacturer = _plcConfig.Manufacturer ?? "Generic";

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
                    return true;
                }
            }
            else if (trimAddr.StartsWith("IW") || trimAddr.StartsWith("AI"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "InputRegisters";
                    return true;
                }
            }
            else if (trimAddr.StartsWith("M") || trimAddr.StartsWith("Q"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "Coils";
                    return true;
                }
            }
            else if (trimAddr.StartsWith("I"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = addr;
                    region = "DiscreteInputs";
                    return true;
                }
            }
        }

        // --- GE FANUC ÖZEL HARİTALAMA ---
        if (manufacturer == "GE Fanuc")
        {
            if (trimAddr.StartsWith("R") || trimAddr.StartsWith("MW") || trimAddr.StartsWith("W"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "HoldingRegisters";
                    return true;
                }
            }
            else if (trimAddr.StartsWith("AI"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "InputRegisters";
                    return true;
                }
            }
            else if (trimAddr.StartsWith("I") && !trimAddr.StartsWith("IW") && !trimAddr.StartsWith("ID"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "DiscreteInputs";
                    return true;
                }
            }
            else if (trimAddr.StartsWith("Q") && !trimAddr.StartsWith("QW") && !trimAddr.StartsWith("QD"))
            {
                string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
                if (ushort.TryParse(numStr, out var addr))
                {
                    address = (ushort)(addr > 0 ? addr - 1 : 0);
                    region = "Coils";
                    return true;
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
                    return true;
                }
            }
        }

        // --- GENERIC / STANDART MODBUS HARİTALAMA ---
        
        // Holding Registers (4x)
        if (trimAddr.StartsWith("MW") || trimAddr.StartsWith("MD") || trimAddr.StartsWith("MF") || 
            trimAddr.StartsWith("ML") || trimAddr.StartsWith("QW") || trimAddr.StartsWith("QD") || 
            trimAddr.StartsWith("R") || trimAddr.StartsWith("AQ"))
        {
            string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
            if (ushort.TryParse(numStr, out var addr))
            {
                address = (ushort)(addr > 0 ? addr - 1 : 0);
                region = "HoldingRegisters";
                return true;
            }
        }
        // Input Registers (3x)
        else if (trimAddr.StartsWith("IW") || trimAddr.StartsWith("ID") || trimAddr.StartsWith("AI"))
        {
            string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
            if (ushort.TryParse(numStr, out var addr))
            {
                address = (ushort)(addr > 0 ? addr - 1 : 0);
                region = "InputRegisters";
                return true;
            }
        }
        // Coils (0x)
        else if (trimAddr.StartsWith("Q") || trimAddr.StartsWith("M"))
        {
            string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
            if (ushort.TryParse(numStr, out var addr))
            {
                address = (ushort)(addr > 0 ? addr - 1 : 0);
                region = "Coils";
                return true;
            }
        }
        // Discrete Inputs (1x)
        else if (trimAddr.StartsWith("I") || trimAddr.StartsWith("S"))
        {
            string numStr = new string(trimAddr.SkipWhile(c => !char.IsDigit(c)).ToArray());
            if (ushort.TryParse(numStr, out var addr))
            {
                address = (ushort)(addr > 0 ? addr - 1 : 0);
                region = "DiscreteInputs";
                return true;
            }
        }
        // Standart Adresleme (40001 vb.)
        if (trimAddr.StartsWith("4") && trimAddr.Length >= 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 40001);
            region = "HoldingRegisters";
            return true;
        }
        if (trimAddr.StartsWith("3") && trimAddr.Length >= 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 30001);
            region = "InputRegisters";
            return true;
        }
        if (trimAddr.StartsWith("1") && trimAddr.Length >= 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 10001);
            region = "DiscreteInputs";
            return true;
        }
        if (trimAddr.StartsWith("0") && trimAddr.Length >= 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 1);
            region = "Coils";
            return true;
        }
        
        // Sadece Ofset
        if (ushort.TryParse(trimAddr, out var rawAddress))
        {
            address = rawAddress;
            region = "HoldingRegisters";
            return true;
        }
        
        return false;
    }

    private double ConvertDataToDouble(ushort[] data, string dataType)
    {
        if (data == null || data.Length == 0) return 0;
        
        string dt = dataType.ToLower();
        string manufacturer = _plcConfig.Manufacturer ?? "Generic";

        switch (dt)
        {
            case "float":
            case "real":
                if (data.Length >= 2)
                {
                    byte[] bytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    // Verified for both Schneider (via AddressOffset) and GE Fanuc
                    BitConverter.GetBytes(data[0]).CopyTo(bytes, 0); 
                    BitConverter.GetBytes(data[1]).CopyTo(bytes, 2);
                    return Math.Round(BitConverter.ToSingle(bytes, 0), 2);
                }
                return data[0];
            case "dint":
            case "int32":
                if (data.Length >= 2)
                {
                    byte[] bytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    BitConverter.GetBytes(data[0]).CopyTo(bytes, 0);
                    BitConverter.GetBytes(data[1]).CopyTo(bytes, 2);
                    return BitConverter.ToInt32(bytes, 0);
                }
                return (short)data[0];
            case "dword":
            case "uint32":
            case "udint":
                if (data.Length >= 2)
                {
                    byte[] bytes = new byte[4];
                    // Standard Little Endian (CDAB / Low-Word First)
                    BitConverter.GetBytes(data[0]).CopyTo(bytes, 0);
                    BitConverter.GetBytes(data[1]).CopyTo(bytes, 2);
                    return BitConverter.ToUInt32(bytes, 0);
                }
                return data[0];
            case "uint":
            case "uint16":
            case "word":
                return data[0];
            case "bool":
            case "boolean":
                return data[0] > 0 ? 1.0 : 0.0;
            case "int":
            case "int16":
            default:
                return (short)data[0];
        }
    }

    public void Dispose()
    {
        Disconnect();
    }
}
