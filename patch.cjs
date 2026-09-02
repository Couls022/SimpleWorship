const fs = require('fs');
let content = fs.readFileSync('src/components/TopToolbar.tsx', 'utf8');
const searchCode = `
          {/* QUICK SEARCH BUTTON */}
          <button
            onClick={onOpenQuickSearch}
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Quick Search Songs (Ctrl+K)"
          >
            <div className="w-7 h-7 flex items-center justify-center mb-0.5">
              <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-xs">
                <Search size={14} />
              </div>
            </div>
            <span className="text-[10px] font-medium tracking-tight">Search</span>
          </button>
`;
content = content.replace('{/* REMOTE BUTTON */}', searchCode + '\n          {/* REMOTE BUTTON */}');
fs.writeFileSync('src/components/TopToolbar.tsx', content);
