const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const port = 502;

const scanChunk = async (client, start, count) => {
    console.log(`Scanning ${start} - ${start + count}...`);
    const res = await client.readHoldingRegisters(start, count);
    const vals = res.response._body._values;
    for (let i = 0; i < vals.length - 1; i++) {
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(vals[i], 0);
        buf.writeUInt16BE(vals[i + 1], 2);
        const f = buf.readFloatBE(0);
        if (f > 30000 && f < 55000) {
            console.log(`FOUND at Offset ${start + i}: ${f.toFixed(2)} (Raw: [${vals[i]}, ${vals[i + 1]}])`);
        }
    }
};

const run = async () => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, 1);

    socket.on('connect', async () => {
        try {
            for (let s = 1000; s < 2500; s += 100) {
                await scanChunk(client, s, 100);
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
