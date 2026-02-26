const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.140'; // Osmaniye GE PLC
const port = 502;

const scanByRegion = async (unitId, region, start, count) => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, unitId);

    return new Promise((resolve) => {
        socket.on('connect', async () => {
            try {
                let res;
                if (region === 'Input') {
                    res = await client.readInputRegisters(start, count);
                } else {
                    res = await client.readHoldingRegisters(start, count);
                }
                const vals = res.response._body._values || res.response._body._valuesAsArray;
                console.log(`Slave ${unitId}, ${region} [${start}]:`, vals);
                socket.end();
                resolve(vals);
            } catch (err) {
                socket.end();
                resolve(null);
            }
        });

        socket.on('error', (err) => {
            resolve(null);
        });

        socket.connect({ host, port });
    });
};

const run = async () => {
    console.log(`Scanning Osmaniye Input Registers (${host})...`);
    for (let i = 0; i < 100; i += 10) {
        await scanByRegion(1, 'Input', i, 10);
    }
    await scanByRegion(1, 'Input', 473, 10);
    console.log('Scan complete.');
};

run();
