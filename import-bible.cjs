const fs = require('fs');
let content = fs.readFileSync('src/components/workspace/BibleLibraryModule.tsx', 'utf-8');

// Add import button
content = content.replace(
  /            <\/span>\n          <\/div>/,
  `            </span>\n            <input type="file" accept=".json" id="bible-import" className="hidden" onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                  if (event.target?.result) {
                    try {
                      const json = JSON.parse(event.target.result as string);
                      if (Array.isArray(json)) {
                         const { dbApi } = await import('../../db');
                         let imported = 0;
                         for (const verse of json) {
                           if (verse.book && verse.chapter && verse.verse && verse.text) {
                              const newVerse = {
                                id: \`\${verse.book.toLowerCase()}-\${verse.chapter}-\${verse.verse}-\${verse.translation || 'KJV'}\`,
                                translation: verse.translation || 'KJV',
                                book: verse.book,
                                chapter: parseInt(verse.chapter),
                                verse: parseInt(verse.verse),
                                reference: \`\${verse.book} \${verse.chapter}:\${verse.verse}\`,
                                text: verse.text
                              };
                              await dbApi.addScripture(newVerse);
                              imported++;
                           }
                         }
                         alert(\`Imported \${imported} verses successfully!\`);
                      } else {
                         alert("Invalid JSON format. Expected an array of verses.");
                      }
                    } catch(err) {
                      console.error("Error importing bible", err);
                      alert("Error importing bible: " + (err as any).message);
                    }
                  }
                };
                reader.readAsText(file);
              }
            }} />
            <button
              onClick={() => document.getElementById('bible-import')?.click()}
              className="text-[10px] bg-[#3a4150] px-1.5 py-0.5 rounded text-gray-300 hover:text-white"
              title="Import JSON Bible format"
            >
              Import JSON
            </button>
          </div>`
);

fs.writeFileSync('src/components/workspace/BibleLibraryModule.tsx', content);
