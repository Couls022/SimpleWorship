const fs = require('fs');

let code = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

code = code.replace(
  /Display \/\} Output \/ Routers/g,
  'Monitor />} Output / Routers'
);

code = code.replace(
  /import \{ X, Monitor, Plus, Trash2, Settings, Type, AlignLeft, Music, Book, Display \} from 'lucide-react';/g,
  "import { X, Monitor, Plus, Trash2, Settings, Type, AlignLeft, Music, Book } from 'lucide-react';"
);

fs.writeFileSync('src/components/SettingsModal.tsx', code);
console.log('patched settings modal 2');
