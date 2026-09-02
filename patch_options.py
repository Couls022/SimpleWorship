with open('src/components/options/OptionsDialog.tsx', 'r') as f:
    content = f.read()

song_preview = """                  <SongLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    songOptions={localOptions.mainOutput.song}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateSong={updateMainSong}
                  />"""

new_song_preview = """                  <SongLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    songOptions={localOptions.mainOutput.song}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateSong={updateMainSong}
                    onUpdateBackdrop={(bg) => store.setDefaultBackground(bg, 'songs', false)}
                  />"""

scripture_preview = """                  <ScriptureLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    scriptureOptions={localOptions.mainOutput.scripture}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateScripture={updateMainScripture}
                  />"""

new_scripture_preview = """                  <ScriptureLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    scriptureOptions={localOptions.mainOutput.scripture}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateScripture={updateMainScripture}
                    onUpdateBackdrop={(bg) => store.setDefaultBackground(bg, 'scriptures', false)}
                  />"""

content = content.replace(song_preview, new_song_preview)
content = content.replace(scripture_preview, new_scripture_preview)

with open('src/components/options/OptionsDialog.tsx', 'w') as f:
    f.write(content)
print("Patched OptionsDialog successfully!")
