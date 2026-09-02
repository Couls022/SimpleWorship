import json

with open('package.json', 'r') as f:
    pkg = json.load(f)

pkg['main'] = 'electron/main.cjs'

if 'scripts' not in pkg:
    pkg['scripts'] = {}

pkg['scripts']['electron:build'] = 'electron-builder --win nsis --x64'
pkg['scripts']['electron:dev'] = 'electron .'

if 'build' in pkg:
    if 'build' in pkg['scripts']:
        pkg['scripts']['build:web'] = pkg['scripts']['build']
        pkg['scripts']['build'] = 'vite build'

if 'devDependencies' not in pkg:
    pkg['devDependencies'] = {}

pkg['devDependencies']['electron'] = '^30.0.0'
pkg['devDependencies']['electron-builder'] = '^24.13.3'

pkg['build'] = {
    "appId": "com.simpleworship.app",
    "productName": "SimpleWorship",
    "directories": {
        "output": "dist-electron"
    },
    "files": [
        "dist/**/*",
        "electron/**/*"
    ],
    "win": {
        "target": [
            "nsis"
        ],
        "icon": "public/favicon.ico"
    },
    "nsis": {
        "oneClick": False,
        "allowToChangeInstallationDirectory": True,
        "perMachine": True,
        "createDesktopShortcut": True,
        "createStartMenuShortcut": True,
        "shortcutName": "SimpleWorship"
    },
    "fileAssociations": [
        {
            "ext": "sws",
            "name": "SimpleWorship Service",
            "description": "SimpleWorship Service Package",
            "icon": "public/favicon.ico",
            "role": "Editor"
        }
    ]
}

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

print("Patched package.json for Electron successfully!")
