const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.build = {
  appId: "com.simpleworship.app",
  productName: "SimpleWorship",
  directories: {
    output: "dist-electron"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  win: {
    target: "nsis"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true
  }
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
