const fs = require('fs');
const tsNode = require('ts-node');
tsNode.register({ compilerOptions: { module: 'commonjs' } });
const { ThemeEngine } = require('./src/core/ThemeEngine.ts');

const font = {
  family: 'Arial',
  maxSize: 100,
  color: '#FFFFFF'
};

const styles = ThemeEngine.fontStyleToThemeStyles(font);
console.log(styles);
