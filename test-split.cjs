const file = require('fs').readFileSync('./src/core/PresentationCore.ts', 'utf8');
const text = "How Great Thou Art\n\nCarl Boberg";
const stanzas = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
console.log("Stanzas count:", stanzas.length);
