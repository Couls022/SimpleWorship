const fs = require('fs');
let content = fs.readFileSync('src/components/ModeratorView.tsx', 'utf8');

const modalRender = `
      {isQuickSearchOpen && (
        <QuickSongSearchModal onClose={() => setIsQuickSearchOpen(false)} />
      )}
`;
content = content.replace('{/* 4. Popups & Modals */}', '{/* 4. Popups & Modals */}' + modalRender);

fs.writeFileSync('src/components/ModeratorView.tsx', content);
