const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const port = 502;

const run = async () => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, 1);

    socket.on('connect', async () => {
        console.log('Monitoring Orhaniye 1757-1760...');
        let count = 0;
        const interval = setInterval(async () => {
            try {
                const res = await client.readHoldingRegisters(1757, 4);
                const vals = res.response._body._values;

                // ABCD (High Word First)
                const abcd_1757_1758 = Buffer.alloc(4);
                abcd_1757_1758.writeUInt16BE(vals[0], 0);
                abcd_1757_1758.writeUInt16BE(vals[1], 2);

                const abcd_1758_1759 = Buffer.alloc(4);
                abcd_1758_1759.writeUInt16BE(vals[1], 0);
                abcd_1758_1759.writeUInt16BE(vals[2], 2);

                console.log(`[${new Date().toISOString()}]`);
                console.log(`  Offsets: [1757: ${vals[0]}, 1758: ${vals[1]}, 1759: ${vals[2]}]`);
                console.log(`  If [1757,1758] ABCD: ${abcd_1757_1758.readFloatBE(0).toFixed(2)}`);
                console.log(`  If [1758,1759] ABCD: ${abcd_1758_1759.readFloatBE(0).toFixed(2)}`);

                if (++count >= 10) {
                    clearInterval(interval);
                    socket.end();
                }
            } catch (err) {
                console.log('Error:', err.message);
                clearInterval(interval);
                socket.end();
            }
        }, 1000);
    });

    socket.connect({ host, port });
};

run();
