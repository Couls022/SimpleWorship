import re

# PATCH SONGLIVEPREVIEW
with open('src/components/options/SongLivePreview.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'onUpdateSong?: (updates: Partial<SystemOptions[\'mainOutput\'][\'song\']>) => void;',
    'onUpdateSong?: (updates: Partial<SystemOptions[\'mainOutput\'][\'song\']>) => void;\n  onUpdateBackdrop?: (bgGradient: string) => void;'
)

old_onClick = 'onClick={() => setActiveBgIndex(idx)}'
new_onClick = '''onClick={() => {
                  setActiveBgIndex(idx);
                  if (onUpdateBackdrop) {
                    onUpdateBackdrop(bg.gradient);
                  }
                }}'''
content = content.replace(old_onClick, new_onClick)

with open('src/components/options/SongLivePreview.tsx', 'w') as f:
    f.write(content)

# PATCH SCRIPTURELIVEPREVIEW
with open('src/components/options/ScriptureLivePreview.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'onUpdateScripture?: (updates: Partial<SystemOptions[\'mainOutput\'][\'scripture\']>) => void;',
    'onUpdateScripture?: (updates: Partial<SystemOptions[\'mainOutput\'][\'scripture\']>) => void;\n  onUpdateBackdrop?: (bgGradient: string) => void;'
)

content = content.replace(old_onClick, new_onClick)

with open('src/components/options/ScriptureLivePreview.tsx', 'w') as f:
    f.write(content)
print("Patched Previews successfully!")
