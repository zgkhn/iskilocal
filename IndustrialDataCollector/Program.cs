using System;
using IndustrialDataCollector.Data;
using IndustrialDataCollector.Drivers;
using IndustrialDataCollector.Interfaces;
using IndustrialDataCollector.Workers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Events;

namespace IndustrialDataCollector;

public class Program
{
    public static void Main(string[] args)
    {
        // Ensure Dapper maps snake_case columns to PascalCase properties
        Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Serilog setup
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}")
            .WriteTo.File("Logs/system-.txt", 
                rollingInterval: RollingInterval.Day,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}")
            .CreateLogger();

        try
        {
            Log.Information("Starting Windows Service Host");
            var builder = Host.CreateApplicationBuilder(args);
            
            // Windows Service host configure
            builder.Services.AddWindowsService(options =>
            {
                options.ServiceName = "Iski Industrial Data Collector";
            });

            // Replace built-in logger with Serilog
            builder.Logging.ClearProviders();
            builder.Logging.AddSerilog(Log.Logger);

            // DI Register
            builder.Services.AddSingleton<IDataRepository, DataRepository>();
            builder.Services.AddSingleton<PlcDriverFactory>();
            
            // Background workers
            builder.Services.AddHostedService<TableSchedulerService>();

            var host = builder.Build();
            host.Run();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Service terminated unexpectedly");
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }
}
