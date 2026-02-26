const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.140'; // Osmaniye GE PLC
const port = 502;

const scanRegion = async (unitId, region, start, count) => {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, unitId);

    return new Promise((resolve) => {
        socket.on('connect', async () => {
            try {
                let res;
                if (region === 'Holding') {
                    res = await client.readHoldingRegisters(start, count);
                } else {
                    res = await client.readInputRegisters(start, count);
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
    console.log(`Scanning Osmaniye (${host})...`);
    await scanRegion(1, 'Holding', 95, 2);
    await scanRegion(1, 'Holding', 473, 2);
    await scanRegion(1, 'Holding', 474, 2);
    console.log('Scan complete.');
};

run();
