import re

with open('src/components/SongEditorModal.tsx', 'r') as f:
    content = f.read()

old_textarea = """                  <textarea
                    value={rawLyrics}
                    onChange={(e) => {
                      let val = e.target.value;
                      const titleMatch = val.match(/^\\s*(?:Title|Title:|Title :)\\s*\\n?([^\\n]+)(?:\\n\\s*\\n|\\n|$)/i);
                      if (titleMatch) {
                        setTitle(titleMatch[1].trim());
                        val = val.replace(titleMatch[0], '').trimStart();
                      }
                      setRawLyrics(val);
                    }}
                    className="flex-1 w-full bg-[#121418] border border-[#2d313f] rounded p-2.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-none custom-scrollbar"
                    placeholder="Enter lyrics, scripture passage, or slide text..."
                  />"""

new_textarea = """                  <textarea
                    value={rawLyrics}
                    onChange={(e) => {
                      let val = e.target.value;
                      const titleMatch = val.match(/^\\s*(?:Title\\s*:|Title)\\s*\\n?([^\\n]+)(?:\\n\\s*\\n|\\n|$)/i);
                      if (titleMatch) {
                        setTitle(titleMatch[1].trim());
                        val = val.replace(titleMatch[0], '').trimStart();
                      }
                      setRawLyrics(val);
                    }}
                    className="flex-1 w-full bg-[#121418] border border-[#2d313f] rounded p-2.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-none custom-scrollbar"
                    placeholder="Enter lyrics, scripture passage, or slide text..."
                  />"""

if old_textarea in content:
    content = content.replace(old_textarea, new_textarea)
    with open('src/components/SongEditorModal.tsx', 'w') as f:
        f.write(content)
    print("Patched Textarea onChange fixed successfully!")
else:
    print("Could not find old_textarea block!")
