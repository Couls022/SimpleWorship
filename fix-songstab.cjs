const fs = require('fs');
const file = 'src/components/resources/SongsTab.tsx';

let content = fs.readFileSync(file, 'utf8');

// Fix closing tags for import/export
content = content.replace(
  "</div>\n              </div>\n            )}\n\n            <input ",
  "</div>\n              </PortalDropdown>\n\n            <input "
);

fs.writeFileSync(file, content);
console.log('Patched closing tags');
