using System;
using System.Net.Sockets;
using System.Threading.Tasks;
using NModbus;

namespace TestModbus
{
    class Program
    {
        static async Task Main(string[] args)
        {
            using var client = new TcpClient("190.133.168.107", 502);
            var factory = new ModbusFactory();
            var master = factory.CreateMaster(client);
            
            ushort address = 1757; // %R1758 - 1
            ushort length = 2;
            byte slaveId = 1;
            
            try {
                var data = await master.ReadHoldingRegistersAsync(slaveId, address, length);
                Console.WriteLine($"Raw Data at {address}: [{data[0]}, {data[1]}]");
                
                byte[] bytes = new byte[4];
                // CDAB
                BitConverter.GetBytes(data[0]).CopyTo(bytes, 0);
                BitConverter.GetBytes(data[1]).CopyTo(bytes, 2);
                float f_cdab = BitConverter.ToSingle(bytes, 0);
                
                // ABCD
                BitConverter.GetBytes(data[1]).CopyTo(bytes, 0);
                BitConverter.GetBytes(data[0]).CopyTo(bytes, 2);
                float f_abcd = BitConverter.ToSingle(bytes, 0);
                
                Console.WriteLine($"Float CDAB: {f_cdab}");
                Console.WriteLine($"Float ABCD: {f_abcd}");
            } catch (Exception ex) {
                Console.WriteLine("Error: " + ex.Message);
            }
        }
    }
}
