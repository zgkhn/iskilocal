const fs = require('fs');
const path = require('path');

// Read logo base64 from extracted files
const iskiB64 = fs.readFileSync(path.join(__dirname, '..', 'İski', 'rmc', 'iski_b64.txt'), 'utf8').trim();
const ibbB64 = fs.readFileSync(path.join(__dirname, '..', 'İski', 'rmc', 'ibb_b64.txt'), 'utf8').trim();

console.log('ISKI B64 length:', iskiB64.length);
console.log('IBB B64 length:', ibbB64.length);

// Read current route.js
const routePath = path.join(__dirname, 'src', 'app', 'api', 'export', 'pdf', 'route.js');
let code = fs.readFileSync(routePath, 'utf8');

// Replace fs/path imports with hardcoded logo constants
code = code.replace(
    /import fs from 'fs';\s*\r?\nimport path from 'path';/,
    `// Logo Base64 strings embedded directly\nconst ISKI_LOGO = 'data:image/png;base64,${iskiB64}';\nconst IBB_LOGO = 'data:image/png;base64,${ibbB64}';`
);

// Replace the fs.readFileSync logo loading block with simple assignment
code = code.replace(
    /let iskiLogoBase64[\s\S]*?console\.error\('Logo loading error:', e\);\s*\r?\n\s*\}/,
    `const iskiLogoBase64 = ISKI_LOGO;\n    const ibbLogoBase64 = IBB_LOGO;`
);

fs.writeFileSync(routePath, code);
console.log('Done! File size:', fs.statSync(routePath).size);
