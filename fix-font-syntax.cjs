const fs = require('fs');
const file = 'src/components/common/SystemFontPicker.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "{isOpen && (\n        {typeof document !== 'undefined' && createPortal(",
  "{isOpen && typeof document !== 'undefined' && createPortal("
);

// Also check the closing braces
content = content.replace(
  "document.body\n      )}\n      )}\n    </div>",
  "document.body\n      )}\n    </div>"
);

fs.writeFileSync(file, content);
