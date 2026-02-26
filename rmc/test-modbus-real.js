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
                console.log(`SUCCESS: Slave ${unitId}, ${region} [${start}-${start + count - 1}]:`, res.response._body._values || res.response._body._valuesAsArray);
                socket.end();
                resolve(true);
            } catch (err) {
                // console.log(`FAIL: Slave ${unitId}, ${region} [${start}]:`, err.message);
                socket.end();
                resolve(false);
            }
        });

        socket.on('error', (err) => {
            console.log(`Socket Error:`, err.message);
            resolve(false);
        });

        socket.connect({ host, port });
    });
};

const run = async () => {
    // Slave ID 0 (Broadcast) ve 1, 2, 255 (Genel Slave ID'ler)
    const slaves = [1, 2, 0, 255];
    const offsets = [0, 95, 473]; // %R1, %R96, %R474

    for (let slave of slaves) {
        for (let offset of offsets) {
            await scanRegion(slave, 'Holding', offset, 2);
            await scanRegion(slave, 'Input', offset, 2);
        }
    }
    console.log('Scan complete.');
};

run();
