const fs = require('fs');

let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

code = code.replace(
  /<div className="absolute right-2 -top-10 z-50">[\s\S]*?<\/div>/,
  `
  <div className="flex items-center">
    <button
      onClick={(e) => { e.stopPropagation(); store.toggleLiveEnabled(groupId); }}
      className={\`px-3 py-1 rounded text-[10px] font-black tracking-widest transition-all \${
        activeControlState?.isLiveEnabled
          ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
      }\`}
    >
      {activeControlState?.isLiveEnabled ? 'LIVE ON • PROJECTOR' : 'LIVE OFF (STANDBY)'}
    </button>
  </div>
  `
);

fs.writeFileSync('src/components/LivePanel.tsx', code);
console.log('patched livepanel 2');
