using System;

namespace IndustrialDataCollector.Entities;

public class Measurement
{
    public long Id { get; set; }
    public int TagId { get; set; }
    public DateTime Timestamp { get; set; }
    public double Value { get; set; }
}
