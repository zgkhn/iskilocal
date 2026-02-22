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
                        if (TryParseAddress(tag.PlcAddress, out ushort address, out bool isInputReg))
                        {
                            ushort[] data;
                            byte slaveId = 1;
                            ushort length = (tag.DataType?.ToLower() == "float" || tag.DataType?.ToLower() == "real") ? (ushort)2 : (ushort)1;

                            if (isInputReg)
                                data = await _modbusMaster.ReadInputRegistersAsync(slaveId, address, length);
                            else
                                data = await _modbusMaster.ReadHoldingRegistersAsync(slaveId, address, length);

                            results[tag.Id] = ConvertDataToDouble(data, tag.DataType ?? "int");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error reading specific tag {TagName} (Addr: {Address}) from PLC {PlcName}. Skipping this tag.", 
                            tag.Name, tag.PlcAddress, _plcConfig.Name);
                        // Münferit tag hatasında durma, dictionary'ye eklenmeyeceği için MonitoringTableTask bunu fark edecek.
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

    private bool TryParseAddress(string addressStr, out ushort address, out bool isInputReg)
    {
        address = 0;
        isInputReg = false;
        if (string.IsNullOrWhiteSpace(addressStr)) return false;

        string trimAddr = addressStr.Trim();
        if (trimAddr.StartsWith("4") && trimAddr.Length == 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 40001);
            return true;
        }
        else if (trimAddr.StartsWith("3") && trimAddr.Length == 5)
        {
            address = (ushort)(int.Parse(trimAddr) - 30001);
            isInputReg = true;
            return true;
        }
        else if (ushort.TryParse(trimAddr, out var rawAddress))
        {
            address = rawAddress;
            return true;
        }
        
        return false;
    }

    private double ConvertDataToDouble(ushort[] data, string dataType)
    {
        if (data == null || data.Length == 0) return 0;
        
        switch (dataType.ToLower())
        {
            case "float":
            case "real":
                if (data.Length >= 2)
                {
                    byte[] bytes = new byte[4];
                    BitConverter.GetBytes(data[1]).CopyTo(bytes, 0); // CD AB Word Swap
                    BitConverter.GetBytes(data[0]).CopyTo(bytes, 2);
                    return Math.Round(BitConverter.ToSingle(bytes, 0), 2);
                }
                return data[0];
            case "int":
                return (short)data[0]; 
            case "bool":
                return data[0] > 0 ? 1.0 : 0.0;
            default:
                return data[0];
        }
    }

    public void Dispose()
    {
        Disconnect();
    }
}
