namespace IndustrialDataManagement.Models;

public class MeasurementDto
{
    public DateTime Timestamp { get; set; }
    public double Value { get; set; }
    
    // JOIN ile getirilecek bilgiler
    public string TagName { get; set; } = null!;
    public string Unit { get; set; } = string.Empty;
    public string TableName { get; set; } = null!;
    public string PlcName { get; set; } = null!;
}
