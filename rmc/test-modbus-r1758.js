const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107'; // Orhaniye GE PLC
const port = 502;

const scanRegion = async (unitId, region, start, count) => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, unitId);

    return new Promise((resolve) => {
        socket.on('connect', async () => {
            console.log(`Checking Slave ${unitId}, Region ${region}, Offset ${start}...`);
            try {
                let res;
                if (region === 'Holding') {
                    res = await client.readHoldingRegisters(start, count);
                } else {
                    res = await client.readInputRegisters(start, count);
                }
                const vals = res.response._body._values || res.response._body._valuesAsArray;
                console.log(`SUCCESS: Slave ${unitId}, ${region} [${start}]:`, vals);
                socket.end();
                resolve(vals);
            } catch (err) {
                console.log(`FAIL: Slave ${unitId}, ${region} [${start}]:`, err.message || err);
                socket.end();
                resolve(null);
            }
        });

        socket.on('error', (err) => {
            console.log(`Socket Error:`, err.message);
            resolve(null);
        });

        socket.connect({ host, port });
    });
};

const run = async () => {
    // %R1758 usually maps to offset 1757
    const offset = 1757;
    console.log(`Scanning Orhaniye (${host}) for %R1758...`);

    await scanRegion(1, 'Holding', offset, 2);
    await scanRegion(1, 'Input', offset, 2);

    // Check surrounding offsets just in case of shifting
    await scanRegion(1, 'Holding', offset - 1, 4);

    console.log('Scan complete.');
};

run();
