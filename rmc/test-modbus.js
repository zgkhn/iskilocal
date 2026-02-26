const Modbus = require('jsmodbus');
const net = require('net');

const host = '190.133.168.107';
const port = 502;
const socket = new net.Socket();
const client = new Modbus.client.TCP(socket, 1);

socket.on('connect', async () => {
    console.log('Connected to PLC');
    try {
        console.log('\n--- Checking %G1 (Offset 12288) and %M1 (Offset 8192) in both regions ---');

        try {
            const coils = await client.readCoils(8192, 10);
            console.log('Coils 8193-8202 (M region?):', coils.response.body.valuesAsArray);
        } catch (e) { console.log('Coil 8192 error:', e.message); }

        try {
            const inputs = await client.readDiscreteInputs(8192, 10);
            console.log('Inputs 8193-8202 (M region?):', inputs.response.body.valuesAsArray);
        } catch (e) { console.log('Input 8192 error:', e.message); }

        try {
            const coilsG = await client.readCoils(12288, 10);
            console.log('Coils 12289-12298 (G region?):', coilsG.response.body.valuesAsArray);
        } catch (e) { console.log('Coil 12288 error:', e.message); }

        try {
            const inputsG = await client.readDiscreteInputs(12288, 10);
            console.log('Inputs 12289-12298 (G region?):', inputsG.response.body.valuesAsArray);
        } catch (e) { console.log('Input 12288 error:', e.message); }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        socket.end();
    }
});
socket.connect({ host, port });
