using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using IndustrialDataCollector.Drivers;
using IndustrialDataCollector.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IndustrialDataCollector.Workers;

public class TableSchedulerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TableSchedulerService> _logger;
    private readonly List<Task> _activeTasks = new();

    public TableSchedulerService(
        IServiceProvider serviceProvider, 
        ILogger<TableSchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Industrial Data Collector Service is starting.");

        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IDataRepository>();
        var driverFactory = scope.ServiceProvider.GetRequiredService<PlcDriverFactory>();
        var taskLoggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();

        while (!stoppingToken.IsCancellationRequested)
        {
        try
        {
            _logger.LogInformation("Ensuring database partitions exist...");
            await repository.EnsurePartitionsExistAsync();

            _logger.LogInformation("Loading configurations from database...");

            var tables = await repository.GetActiveMonitoringTablesAsync();
            var tableList = tables.ToList();

            if (!tableList.Any())
            {
                _logger.LogWarning("No active monitoring tables found in database.");
                // Eğer tablo yoksa, iptal edilene kadar veya bir süre bekleyip tekrar denemek için loop'ta kalabiliriz.
                // Şimdilik basitçe bekleyelim.
            }
            else
            {
                _logger.LogInformation("Found {Count} active tables. Initializing scheduler tasks...", tableList.Count);

                foreach (var table in tableList)
                {
                    var tags = await repository.GetActiveTagsByTableIdAsync(table.Id);
                    if (!tags.Any())
                    {
                        _logger.LogWarning("Table '{TableName}' has no active tags. Skipping...", table.Name);
                        continue;
                    }

                    var driver = driverFactory.CreateDriver(table.Plc);
                    var taskLogger = taskLoggerFactory.CreateLogger<MonitoringTableTask>();

                    var schedulerTaskContext = new MonitoringTableTask(table, tags, driver, repository, taskLogger);
                    
                    var runTask = schedulerTaskContext.RunAsync(stoppingToken);
                    _activeTasks.Add(runTask);
                }

                _logger.LogInformation("All scheduler tasks are initialized. Waiting for stop signal.");
            }

            // Uygulama kapanana kadar bekle
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Service is stopping...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Critical error in TableSchedulerService.");
        }
        finally
        {
            // Tüm görevlerin bitmesini bekle (opsiyonel, shutdown süresini uzatabilir)
            if (_activeTasks.Any())
            {
                await Task.WhenAll(_activeTasks);
            }
        }
        }

        _logger.LogInformation("Industrial Data Collector Service is stopping.");
    }
}
