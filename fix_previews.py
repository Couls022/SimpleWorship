import re

def fix_interface(file_path, type_name):
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix interface
    if type_name == 'song':
        bad_interface = """  onUpdateSong,
  onUpdateBackdrop?: (updates: Partial<SystemOptions['mainOutput']['song']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;"""
        good_interface = """  onUpdateSong?: (updates: Partial<SystemOptions['mainOutput']['song']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;"""
        content = content.replace(bad_interface, good_interface)
    elif type_name == 'scripture':
        bad_interface = """  onUpdateScripture,
  onUpdateBackdrop?: (updates: Partial<SystemOptions['mainOutput']['scripture']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;"""
        good_interface = """  onUpdateScripture?: (updates: Partial<SystemOptions['mainOutput']['scripture']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;"""
        content = content.replace(bad_interface, good_interface)

    with open(file_path, 'w') as f:
        f.write(content)

fix_interface('src/components/options/SongLivePreview.tsx', 'song')
fix_interface('src/components/options/ScriptureLivePreview.tsx', 'scripture')
print("Fixed interfaces!")
