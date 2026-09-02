const fs = require('fs');
let content = fs.readFileSync('src/components/ModeratorView.tsx', 'utf8');

// Add to Escape handler
content = content.replace('setIsShortcutsOpen(false);', 'setIsShortcutsOpen(false);\n        setIsQuickSearchOpen(false);');

// Add Ctrl+K handler
const ctrlK = `
      // Quick Search
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(true);
        return;
      }
`;
content = content.replace('      // 6. Escape Key', ctrlK + '      // 6. Escape Key');

fs.writeFileSync('src/components/ModeratorView.tsx', content);
