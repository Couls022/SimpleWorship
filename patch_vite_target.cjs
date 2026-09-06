const fs = require('fs');
let file = fs.readFileSync('vite.config.ts', 'utf8');
file = file.replace(/target: 'esnext',/, "target: 'es2022',");
fs.writeFileSync('vite.config.ts', file);
console.log('Patched vite target');
