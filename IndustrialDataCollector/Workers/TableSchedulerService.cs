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
    private CancellationTokenSource? _monitoringCts;

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

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var repository = scope.ServiceProvider.GetRequiredService<IDataRepository>();
                var driverFactory = scope.ServiceProvider.GetRequiredService<PlcDriverFactory>();
                var taskLoggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();

                _logger.LogInformation("Ensuring database partitions exist...");
                await repository.EnsurePartitionsExistAsync();

                _logger.LogInformation("Loading configurations from database...");

                var tables = await repository.GetActiveMonitoringTablesAsync();
                var tableList = tables.ToList();

                if (!tableList.Any())
                {
                    _logger.LogWarning("No active monitoring tables found in database.");
                }
                else
                {
                    _logger.LogInformation("Found {Count} active tables. Initializing scheduler tasks...", tableList.Count);

                    _monitoringCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    _activeTasks.Clear();

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
                        
                        var runTask = schedulerTaskContext.RunAsync(_monitoringCts.Token);
                        _activeTasks.Add(runTask);
                    }

                    _logger.LogInformation("All scheduler tasks are initialized. Watching for signals or stop.");
                }

                // Check for reload signals periodically
                bool reloadRequested = false;
                while (!stoppingToken.IsCancellationRequested && !reloadRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                    
                    if (await repository.HasPendingReloadSignalAsync())
                    {
                        _logger.LogInformation("Reload signal detected! Restarting monitoring tasks...");
                        await repository.MarkReloadSignalsAsProcessedAsync();
                        reloadRequested = true;
                    }
                }

                if (reloadRequested)
                {
                    await StopMonitoringTasksAsync();
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Service is stopping...");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Critical error in TableSchedulerService main loop.");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); // Hata durumunda bekle
            }
        }

        await StopMonitoringTasksAsync();
        _logger.LogInformation("Industrial Data Collector Service is stopped.");
    }

    private async Task StopMonitoringTasksAsync()
    {
        if (_monitoringCts != null)
        {
            _monitoringCts.Cancel();
            if (_activeTasks.Any())
            {
                _logger.LogInformation("Waiting for {Count} monitoring tasks to stop...", _activeTasks.Count);
                try
                {
                    await Task.WhenAll(_activeTasks);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error occurred while stopping monitoring tasks.");
                }
            }
            _monitoringCts.Dispose();
            _monitoringCts = null;
        }
    }
}
