const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const socket = new net.Socket();
const client = new Modbus.client.TCP(socket, 1);

socket.on('connect', async () => {
    console.log(`CONNECTED TO GE FANUC: ${host}`);
    try {
        // Scan Holding Registers around 92
        console.log("\n--- SCANNING HOLDING REGISTERS 80-110 ---");
        const resp4 = await client.readHoldingRegisters(80, 31);
        const regs = resp4.response._body._values;
        for (let i = 0; i < regs.length; i++) {
            const addr = 80 + i;
            if (regs[i] !== 0) {
                console.log(`Addr ${addr} (4x): ${regs[i]}`);
            }
        }

        // Scan Coils (0x) for %M1
        console.log("\n--- SCANNING COILS 0-100 ---");
        const resp0 = await client.readCoils(0, 100);
        const coils = resp0.response._body.values;
        for (let i = 0; i < 100; i++) {
            if (coils[i]) {
                console.log(`Coil ${i} (0x): ${coils[i]}`);
            }
        }

        // Scan Discrete Inputs (1x)
        console.log("\n--- SCANNING DISCRETE INPUTS 0-100 ---");
        try {
            const resp1 = await client.readDiscreteInputs(0, 100);
            const inputs = resp1.response._body.values;
            for (let i = 0; i < 100; i++) {
                if (inputs[i]) {
                    console.log(`Input ${i} (1x): ${inputs[i]}`);
                }
            }
        } catch (e) { console.log("Discrete Inputs Scan Error:", e.message); }

        socket.end();
    } catch (e) {
        console.error("Error:", e.message);
        socket.end();
    }
});
socket.on('error', (err) => console.log("Socket error:", err.message));
socket.connect(502, host);
