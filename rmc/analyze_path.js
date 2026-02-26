const path = require('path');
const dir = __dirname;
console.log('Dir:', dir);
console.log('Hex:', Buffer.from(dir).toString('hex'));
console.log('Normalization test:');
console.log('NFC:', dir.normalize('NFC'));
console.log('NFD:', dir.normalize('NFD'));
console.log('Is NFC equal to NFD:', dir.normalize('NFC') === dir.normalize('NFD'));
