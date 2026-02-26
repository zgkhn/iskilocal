using System;
using System.Linq;
using Npgsql;
using Dapper;

var connectionString = "Host=190.133.168.179;Database=iski_db;Username=postgres;Password=123456;";
using var conn = new NpgsqlConnection(connectionString);
conn.Open();

Console.WriteLine("\n--- VERIFICATION: Final Measurements Check ---");
var measurements = conn.Query(@"
    SELECT m.timestamp, m.tag_id, m.value, t.name as tag_name, p.manufacturer 
    FROM measurements m 
    JOIN tags t ON m.tag_id = t.id 
    JOIN monitoring_tables mt ON t.monitoring_table_id = mt.id
    JOIN plcs p ON mt.plc_id = p.id
    ORDER BY m.timestamp DESC LIMIT 20");
foreach (var m in measurements)
{
    Console.WriteLine($"{m.timestamp}: Tag {m.tag_id} ({m.tag_name}) [Mfr: {m.manufacturer}] = {m.value}");
}
