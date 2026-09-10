const fs = require('fs');

let code = fs.readFileSync('src/components/LivePanel.tsx', 'utf8');

const targetStr = `<div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 px-2 py-1 bg-[#181920] rounded border border-[#252834] flex items-center justify-between shrink-0 shadow-xs">`;

const replaceStr = targetStr + `
  <div className="absolute right-2 -top-10 z-50">
    <button
      onClick={(e) => { e.stopPropagation(); store.toggleLiveEnabled(groupId); }}
      className={\`px-4 py-1.5 rounded text-xs font-black tracking-widest transition-all \${
        activeControlState?.isLiveEnabled
          ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
      }\`}
    >
      {activeControlState?.isLiveEnabled ? 'LIVE ON • PROJECTOR ACTIVE' : 'LIVE OFF (STANDBY)'}
    </button>
  </div>
`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/LivePanel.tsx', code);
console.log('patched livepanel');
