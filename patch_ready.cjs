const fs = require('fs');
let code = fs.readFileSync('electron/main.cjs', 'utf8');

code = code.replace(
  /if \(process\.env\.NODE_ENV === 'development' \|\| !app\.isPackaged\) \{[\s\S]*?\} else \{[\s\S]*?\}/,
  `mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }`
);

fs.writeFileSync('electron/main.cjs', code);
console.log('patched ready-to-show cleanly');
