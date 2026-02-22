using System;
using IndustrialDataCollector.Entities;
using IndustrialDataCollector.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IndustrialDataCollector.Drivers;

public class PlcDriverFactory
{
    private readonly IServiceProvider _serviceProvider;

    public PlcDriverFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IPlcDriver CreateDriver(Plc plcConfig)
    {
        return plcConfig.Protocol.ToLower() switch
        {
            "modbustcp" => new ModbusTcpDriver(plcConfig, _serviceProvider.GetRequiredService<ILogger<ModbusTcpDriver>>()),
            // "opcua" => new OpcUaDriver(...) // İleride eklenebilir
            // "s7" => new S7Driver(...)
            _ => throw new NotSupportedException($"Protocol {plcConfig.Protocol} is not supported.")
        };
    }
}
