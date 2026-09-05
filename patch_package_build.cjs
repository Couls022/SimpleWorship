const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['build'] = 'vite build && node scripts/postbuild.cjs';
pkg.scripts['dist'] = 'vite build && node scripts/postbuild.cjs && electron-builder --win';
pkg.scripts['dist:dir'] = 'vite build && node scripts/postbuild.cjs && electron-builder --dir';
pkg.scripts['build:installer'] = 'vite build && node scripts/postbuild.cjs && electron-builder --win';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
