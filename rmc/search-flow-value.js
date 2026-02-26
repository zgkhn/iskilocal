const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const port = 502;

const run = async () => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, 1);

    socket.on('connect', async () => {
        try {
            console.log('Searching for flow value (approx 35000-45000) in offsets 1000-2000...');
            const start = 1000;
            const count = 1000;
            const res = await client.readHoldingRegisters(start, count);
            const vals = res.response._body._values;

            let found = false;
            for (let i = 0; i < vals.length - 1; i++) {
                const buf = Buffer.alloc(4);
                // ABCD
                buf.writeUInt16BE(vals[i], 0);
                buf.writeUInt16BE(vals[i + 1], 2);
                const f = buf.readFloatBE(0);

                if (f > 30000 && f < 50000) {
                    console.log(`FOUND at Offset ${start + i}: ${f.toFixed(2)} (Raw: [${vals[i]}, ${vals[i + 1]}])`);
                    found = true;
                }
            }
            if (!found) console.log('No matching float values found in this range.');
        } catch (err) {
            console.log('Error:', err.message);
        } finally {
            socket.end();
        }
    });

    socket.connect({ host, port });
};

run();
