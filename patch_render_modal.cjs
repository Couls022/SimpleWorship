const fs = require('fs');
let code = fs.readFileSync('src/components/TopToolbar.tsx', 'utf8');

code = code.replace(
    "    </header>",
    "      {showProfilesModal && <ProfilesManagerModal onClose={() => setShowProfilesModal(false)} />}\n    </header>"
);

fs.writeFileSync('src/components/TopToolbar.tsx', code, 'utf8');
console.log('patched modal');
