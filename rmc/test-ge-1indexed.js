const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const socket = new net.Socket();
const client = new Modbus.client.TCP(socket, 1);

socket.on('connect', async () => {
    console.log(`CONNECTED TO GE FANUC: ${host}`);
    try {
        // Test %R92 as 1-indexed (Address 91)
        const respR92 = await client.readHoldingRegisters(91, 1);
        console.log(`%R92 (1-indexed, Addr 91): ${respR92.response._body._values[0]}`);

        // Test %M1 as 1-indexed (Coil 0)
        const respM1 = await client.readCoils(0, 1);
        console.log(`%M1 (1-indexed, Coil 0): ${respM1.response._body.values[0] ? 1 : 0}`);

        socket.end();
    } catch (e) {
        console.error("Error:", e.message);
        socket.end();
    }
});
socket.connect(502, host);
