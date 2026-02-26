const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const port = 502;

const run = async () => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, 1);

    socket.on('connect', async () => {
        try {
            console.log('Scanning Orhaniye 1750-1770 as Real (ABCD)...');
            const res = await client.readHoldingRegisters(1750, 20);
            const vals = res.response._body._values;

            for (let i = 0; i < vals.length - 1; i++) {
                const buf = Buffer.alloc(4);
                buf.writeUInt16BE(vals[i], 0);
                buf.writeUInt16BE(vals[i + 1], 2);
                const f = buf.readFloatBE(0);

                console.log(`Modbus Offset ${1750 + i}: ${f.toFixed(2)} (Raw: [${vals[i]}, ${vals[i + 1]}])`);
            }
        } catch (err) {
            console.log('Error:', err.message);
        } finally {
            socket.end();
        }
    });

    socket.connect({ host, port });
};

run();
