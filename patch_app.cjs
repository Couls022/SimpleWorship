const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = 'async function init() {';
const repl1 = 'async function init() {\n      try {';

const target2 = '      setIsReady(true);';
const repl2 = `      setIsReady(true);
      } catch (err: any) {
        console.error("FATAL BOOT ERROR:", err);
        document.body.innerHTML = \`<div style="padding: 40px; color: red; background: white; font-family: sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999;"><h1>Fatal Boot Error</h1><p>\${err.message}</p><pre>\${err.stack}</pre></div>\`;
      }`;

file = file.replace(target1, repl1);
file = file.replace(target2, repl2);

fs.writeFileSync('src/App.tsx', file);
console.log('Patched App.tsx successfully');
