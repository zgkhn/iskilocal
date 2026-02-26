// GE PLC %R96 (Holding 95-96) ham verileri: [17190, 55706]
const registers = [17190, 55706];

const toFloat = (regs, lowWordFirst) => {
    const buffer = Buffer.alloc(4);
    if (lowWordFirst) {
        // GE Fanuc: Low Word First
        buffer.writeUInt16LE(regs[0], 0);
        buffer.writeUInt16LE(regs[1], 2);
    } else {
        // Standart Modbus / High Word First
        buffer.writeUInt16BE(regs[0], 0);
        buffer.writeUInt16BE(regs[1], 2);
    }
    return buffer.readFloatBE(0); // Bu kısım buffer düzenine göre değişir, aşağıda daha detaylı test edelim
};

const testAllEndianness = (regs) => {
    const buffer = Buffer.alloc(4);

    // 1. ABCD (Big Endian - Word & Byte)
    buffer.writeUInt16BE(regs[0], 0);
    buffer.writeUInt16BE(regs[1], 2);
    console.log("ABCD (BE):", buffer.readFloatBE(0));

    // 2. CDAB (Word Swapped) - GE Fanuc için yaygın
    buffer.writeUInt16BE(regs[1], 0);
    buffer.writeUInt16BE(regs[0], 2);
    console.log("CDAB (Word Swapped):", buffer.readFloatBE(0));

    // 3. BADC (Byte Swapped)
    buffer.writeUInt16BE(regs[0], 0);
    buffer.writeUInt16BE(regs[1], 2);
    const badc = Buffer.from([buffer[1], buffer[0], buffer[3], buffer[2]]);
    console.log("BADC (Byte Swapped):", badc.readFloatBE(0));

    // 4. DCBA (Little Endian)
    buffer.writeUInt16LE(regs[1], 0);
    buffer.writeUInt16LE(regs[0], 2);
    console.log("DCBA (LE):", buffer.readFloatLE(0));

    // Basit Modbus ReadFloat (C# mantığına en yakın)
    // Low Word First (Eski C# Kodumuz): BitConverter.GetBytes(data[0]).CopyTo(bytes, 0); BitConverter.GetBytes(data[1]).CopyTo(bytes, 2);
    const bytes = Buffer.alloc(4);
    const low = regs[0]; // 17190
    const high = regs[1]; // 55706
    bytes.writeUInt16LE(low, 0);
    bytes.writeUInt16LE(high, 2);
    console.log("C# Low Word First (Current Code):", bytes.readFloatLE(0));
};

console.log("Testing with registers [17190, 55706]:");
testAllEndianness(registers);
