import re

files = [
    'src/components/MediaLibraryModal.tsx',
    'src/components/workspace/MediaLibraryPanel.tsx',
    'src/components/resources/MediaTab.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    content = content.replace("setDefaultBackground(asset.id", "setDefaultBackground(asset.url")
    with open(file, 'w') as f:
        f.write(content)

print("Reverted to asset.url")
