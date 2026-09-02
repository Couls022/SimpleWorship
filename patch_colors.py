import re

with open('src/components/LivePanel.tsx', 'r') as f:
    content = f.read()

# Replace the specific color line inside the loop
old_color_code = """                        <div className={`${viewMode === 'large' ? 'px-3 py-1 text-xs' : viewMode === 'small' || viewMode === 'summary' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} font-bold truncate border-b border-black/30 ${
                          isScripture ? 'bg-[#5f171d] text-rose-100' : 'bg-[#1e2a44] text-blue-100'
                        }`}>"""

new_color_code = """                        <div className={`${viewMode === 'large' ? 'px-3 py-1 text-xs' : viewMode === 'small' || viewMode === 'summary' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} font-bold truncate border-b border-black/30 ${
                          (() => {
                            const t = (slide.title || liveItem?.name || '').toLowerCase();
                            if (isScripture) return 'bg-[#5f171d] text-rose-100';
                            if (!isSong) return 'bg-[#1e2a44] text-blue-100';
                            
                            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900 text-emerald-100 border-emerald-700/50';
                            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900 text-purple-100 border-purple-700/50';
                            if (t.includes('pre-chorus')) return 'bg-amber-900 text-amber-100 border-amber-700/50';
                            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900 text-rose-100 border-rose-700/50';
                            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\\d+$/)) return 'bg-indigo-900 text-indigo-100 border-indigo-700/50';
                            
                            return 'bg-[#1e2a44] text-blue-100'; // Default Blue
                          })()
                        }`}>"""

if old_color_code in content:
    content = content.replace(old_color_code, new_color_code)
    with open('src/components/LivePanel.tsx', 'w') as f:
        f.write(content)
    print("Patched LivePanel successfully!")
else:
    print("Could not find old_color_code block!")
