using System.Collections.Generic;
using System.Threading.Tasks;

namespace IndustrialDataCollector.Interfaces;

public interface IPlcDriver
{
    bool TestConnection();
    Task<IDictionary<int, double>> ReadTagsAsync(IEnumerable<Entities.Tag> tags);
    Task ConnectAsync();
    void Disconnect();
}
