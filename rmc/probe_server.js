const http = require('http');

function probe() {
    console.log('Probing RMC at http://localhost:3001...');
    http.get('http://localhost:3001', (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Response body preview:', data.substring(0, 500));
        });
    }).on('error', (err) => {
        console.error('Error probing:', err.message);
    });
}

setTimeout(probe, 2000);
