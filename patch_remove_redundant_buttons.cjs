const fs = require('fs');
let code = fs.readFileSync('src/components/workspace/FixedLiveDisplay.tsx', 'utf8');

const targetContent = `              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setStagedGroupState(effectiveGroupId, { isVideoPlaying: !(stagedControlState?.isVideoPlaying ?? true) })}
                  className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer select-none active:scale-95 \${
                    stagedControlState?.isVideoPlaying ?? true
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      : 'bg-amber-950/90 text-amber-300 border border-amber-700/80 hover:bg-amber-900 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  }\`}
                  title={stagedControlState?.isVideoPlaying ?? true ? 'Click to Pause' : 'Click to Resume Playback'}
                >
                  {stagedControlState?.isVideoPlaying ?? true ? '► PLAYING' : '❚❚ PAUSED'}
                </button>
                <button
                  type="button"
                  onClick={() => setStagedGroupState(effectiveGroupId, { isVideoLooping: !(stagedControlState?.isVideoLooping ?? true) })}
                  className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer select-none active:scale-95 \${
                    stagedControlState?.isVideoLooping ?? true
                      ? 'bg-cyan-950/90 text-cyan-300 border-cyan-600/80 hover:bg-cyan-900 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-gray-200'
                  }\`}
                  title="Toggle Continuous Media Looping"
                >
                  {stagedControlState?.isVideoLooping ?? true ? '🔁 LOOP ON' : '➡️ LOOP OFF'}
                </button>
              </div>`;

if (code.includes(targetContent)) {
  code = code.replace(targetContent, '');
  fs.writeFileSync('src/components/workspace/FixedLiveDisplay.tsx', code);
  console.log("Successfully removed redundant buttons.");
} else {
  console.log("Could not find exact target string. Let's try matching with regex.");
}
