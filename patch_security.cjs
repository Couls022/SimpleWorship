const fs = require('fs');
let file = fs.readFileSync('electron/main.cjs', 'utf8');
file = file.replace(/sandbox: true,/g, 'sandbox: true,\n      webSecurity: false,');
fs.writeFileSync('electron/main.cjs', file);
console.log('Patched security');
