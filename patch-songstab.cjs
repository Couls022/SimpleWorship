const fs = require('fs');
const path = require('path');
const file = 'src/components/resources/SongsTab.tsx';

let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('PortalDropdown')) {
  content = content.replace("import { OfflineSearchEngine } from '../../core/OfflineSearchEngine';", "import { OfflineSearchEngine } from '../../core/OfflineSearchEngine';\nimport { PortalDropdown } from '../common/PortalDropdown';");
}

// Remove old click outside logic
const clickOutsideRegex = /\s*\/\/ Close dropdowns when clicking outside\s*useEffect\(\(\) => \{\s*const handleOutsideClick = \(e: MouseEvent\) => \{\s*const target = e.target as Node;\s*if \(categoryDropdownRef.current && !categoryDropdownRef.current.contains\(target\)\) \{\s*setIsCategoryOpen\(false\);\s*\}\s*if \(importExportDropdownRef.current && !importExportDropdownRef.current.contains\(target\)\) \{\s*setIsImportExportOpen\(false\);\s*\}\s*\};\s*document.addEventListener\('mousedown', handleOutsideClick\);\s*return \(\) => document.removeEventListener\('mousedown', handleOutsideClick\);\s*\}, \[\]\);/g;

content = content.replace(clickOutsideRegex, '');

// Replace category dropdown
content = content.replace(
  "{isCategoryOpen && (\n              <div className=\"absolute top-full left-0 mt-1.5 w-60 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md\">",
  "<PortalDropdown isOpen={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} triggerRef={categoryDropdownRef} className=\"w-60 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md\">"
);

content = content.replace(
  "Clear Category Filter\n                    </button>\n                  </div>\n                )}\n              </div>\n            )}",
  "Clear Category Filter\n                    </button>\n                  </div>\n                )}\n              </PortalDropdown>"
);

// Replace import/export dropdown
content = content.replace(
  "{isImportExportOpen && (\n              <div className=\"absolute top-full left-0 mt-1.5 w-64 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md\">",
  "<PortalDropdown isOpen={isImportExportOpen} onClose={() => setIsImportExportOpen(false)} triggerRef={importExportDropdownRef} align=\"right\" className=\"w-64 bg-[#1a1c24] border border-[#2e3342] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md\">"
);

content = content.replace(
  "Restore Default Hymns\n                      <span className=\"text-[10px] text-gray-400\">Add 30 standard hymns if missing</span>\n                    </div>\n                  </button>\n                </div>\n              </div>\n            )}",
  "Restore Default Hymns\n                      <span className=\"text-[10px] text-gray-400\">Add 30 standard hymns if missing</span>\n                    </div>\n                  </button>\n                </div>\n              </PortalDropdown>"
);

fs.writeFileSync(file, content);
console.log('Patched SongsTab');
