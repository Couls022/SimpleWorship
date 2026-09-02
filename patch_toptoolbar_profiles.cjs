const fs = require('fs');
let code = fs.readFileSync('src/components/TopToolbar.tsx', 'utf8');

// Import ProfilesManagerModal
if (!code.includes('import ProfilesManagerModal')) {
    code = code.replace(
        "import { Schedule } from '../types';",
        "import { Schedule } from '../types';\nimport ProfilesManagerModal from './ProfilesManagerModal';"
    );
}

// Add state
if (!code.includes('showProfilesModal')) {
    code = code.replace(
        "export default function TopToolbar({",
        "export default function TopToolbar({"
    );
    // Let's find the main component body
    code = code.replace(
        "const [activeMenu, setActiveMenu] = useState<string | null>(null);",
        "const [activeMenu, setActiveMenu] = useState<string | null>(null);\n  const [showProfilesModal, setShowProfilesModal] = useState(false);"
    );
}

// Find profiles in store
if (!code.includes('const store = useStore();')) {
    // Wait, it already has `const store = useStore();`
}

// Replace the hardcoded profiles menu
const hardcodedMenu = `
            {activeMenu === 'Profiles' && (
              <div className="absolute left-0 top-full mt-0.5 w-48 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200">
                <button onClick={() => handleNotify('Profile: Default')} className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#323744] hover:text-white">
                  <span>Default</span>
                  <Check size={12} className="text-cyan-400" />
                </button>
                <button onClick={() => handleNotify('Profile: Youth Ministry')} className="w-full text-left px-3 py-1 hover:bg-[#323744] hover:text-white">
                  Youth Ministry
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button onClick={() => handleNotify('Profiles Manager')} className="w-full text-left px-3 py-1 hover:bg-[#323744] hover:text-white">
                  Profiles Manager...
                </button>
              </div>
            )}
`;

const dynamicMenu = `
            {activeMenu === 'Profiles' && (
              <div className="absolute left-0 top-full mt-0.5 w-48 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200">
                {store.profiles?.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { store.setActiveProfile(p.id); setActiveMenu(null); }} 
                    className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#323744] hover:text-white"
                  >
                    <span>{p.name}</span>
                    {store.activeProfileId === p.id && <Check size={12} className="text-cyan-400" />}
                  </button>
                ))}
                <div className="border-t border-[#313540] my-1"></div>
                <button onClick={() => { setShowProfilesModal(true); setActiveMenu(null); }} className="w-full text-left px-3 py-1 hover:bg-[#323744] hover:text-white">
                  Profiles Manager...
                </button>
              </div>
            )}
`;

code = code.replace(hardcodedMenu.trim(), dynamicMenu.trim());

// Render modal at the end
code = code.replace(
    "      {/* Keyboard Shortcuts Guide */}",
    "      {showProfilesModal && <ProfilesManagerModal onClose={() => setShowProfilesModal(false)} />}\n\n      {/* Keyboard Shortcuts Guide */}"
);

fs.writeFileSync('src/components/TopToolbar.tsx', code, 'utf8');
console.log('patched');
