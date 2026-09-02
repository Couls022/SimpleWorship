import re

with open('src/components/SongEditorModal.tsx', 'r') as f:
    content = f.read()

old_list_item = """                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1">
                        <span className="text-cyan-300">{slide.label}</span>
                        <span className="text-gray-500 text-[10px] font-mono">#{idx + 1}</span>
                      </div>"""

new_list_item = """                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className={`px-1.5 py-0.5 rounded ${
                          (() => {
                            const t = slide.label.toLowerCase();
                            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
                            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900/50 text-purple-300 border border-purple-700/50';
                            if (t.includes('pre-chorus')) return 'bg-amber-900/50 text-amber-300 border border-amber-700/50';
                            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900/50 text-rose-300 border border-rose-700/50';
                            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\\d+$/)) return 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50';
                            return 'bg-[#293245] text-cyan-300 border border-cyan-700/50';
                          })()
                        }`}>{slide.label}</span>
                        <span className="text-gray-500 text-[10px] font-mono">#{idx + 1}</span>
                      </div>"""

if old_list_item in content:
    content = content.replace(old_list_item, new_list_item)
    with open('src/components/SongEditorModal.tsx', 'w') as f:
        f.write(content)
    print("Patched SongEditorModal successfully (list items)!")
else:
    print("Could not find old_list_item block!")
