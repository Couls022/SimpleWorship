#!/bin/bash
mkdir -p audit-reports
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
REPORT="audit-reports/deep-production-audit-$TIMESTAMP.txt"

echo "SimpleWorship Deep Production Audit" > "$REPORT"
echo "Generated: $(date)" >> "$REPORT"
echo "Root: $(pwd)" >> "$REPORT"

function Section() {
    echo "" >> "$REPORT"
    echo "============================================================" >> "$REPORT"
    echo "$1" >> "$REPORT"
    echo "============================================================" >> "$REPORT"
}

function Run() {
    echo "" >> "$REPORT"
    echo ">>> $1" >> "$REPORT"
    echo "COMMAND: $2" >> "$REPORT"
    echo "------------------------------------------------------------" >> "$REPORT"
    eval "$2" >> "$REPORT" 2>&1 || echo "(Command exited with non-zero status)" >> "$REPORT"
}

Section "1. DEVELOPMENT ENVIRONMENT"
Run "Node version" "node --version"
Run "NPM version" "npm --version"
Run "NPX version" "npx --version"
Run "Git version" "git --version"

Section "2. PROJECT STRUCTURE"
Run "Top-level files" "ls -lh"
Run "Package files" "find . -maxdepth 3 -name 'package*.json' -o -name '*lock*'"

Section "3. PACKAGE.JSON"
Run "package.json" "cat package.json"

Section "4. DEPENDENCY HEALTH"
Run "NPM dependency tree" "npm ls --depth=0"
Run "NPM audit" "npm audit || true"
Run "Outdated packages" "npm outdated || true"

Section "5. TYPESCRIPT / JAVASCRIPT HEALTH"
Run "TypeScript config" "cat tsconfig.json"
Run "TypeScript check" "npx tsc --noEmit"

Section "6. CODE QUALITY"
Run "NPM scripts" "cat package.json | grep -A 10 '\"scripts\"'"
Run "ESLint" "npm run lint || true"

Section "7. TESTING"
Run "Test script" "npm run test || true"

Section "8. APPLICATION BUILD"
Run "Production build" "npm run build || true"

Section "9. WINDOWS PACKAGING / INSTALLER"
Run "Installer scripts" "npm run build:installer || echo 'No build:installer script'"
Run "Electron Builder version" "npx electron-builder --version || echo 'Not installed'"

Section "10. ELECTRON CONFIGURATION"
Run "Electron Configs" "for f in electron-builder.yml electron-builder.json forge.config.js vite.config.ts; do if [ -f \$f ]; then echo 'FOUND: ' \$f; cat \$f; fi; done"

Section "11. SOURCE CODE INVENTORY"
Run "TS/JS files count" "find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | wc -l"
Run "Largest source files" "find src electron -type f -exec ls -sh {} + | sort -rh | head -n 20"

Section "12. UNFINISHED CODE / TECHNICAL DEBT"
Run "TODO/FIXME/HACK scan" "grep -rnE 'TODO|FIXME|HACK|XXX|TEMP|WORKAROUND|NOT_IMPLEMENTED|throw new Error' src/ electron/ | head -n 50"

Section "13. DEBUG CODE"
Run "console.log scan" "grep -rnE 'console\.log|console\.debug|debugger;' src/ electron/ | head -n 50"

Section "14. SECURITY / SECRET SCAN"
Run "Environment files" "find . -maxdepth 2 -name '.env*' -o -name '*.pem' -o -name '*.key'"
Run "Potential secrets" "grep -rnE 'API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY' src/ electron/ package.json | head -n 30"

Section "15. DATABASE / LOCAL STORAGE"
Run "Database references" "grep -rnE 'sqlite|SQLite|better-sqlite|sqlcipher|database|indexedDB|localStorage|electron-store' src/ electron/ | head -n 50"

Section "16. MEDIA / LIVE OUTPUT ARCHITECTURE"
Run "Video/media/display references" "grep -rnE 'video|audio|media|HTMLVideoElement|HTMLAudioElement|BrowserWindow|screen|display|fullscreen' src/ electron/ | head -n 50"

Section "17. ELECTRON IPC / SECURITY"
Run "IPC references" "grep -rnE 'ipcMain|ipcRenderer|contextBridge|preload|nodeIntegration|contextIsolation|webSecurity|sandbox' src/ electron/"

Section "18. ERROR HANDLING"
Run "try/catch scan" "grep -rnE 'catch\s*\(' src/ electron/ | head -n 20"

Section "19. FILESYSTEM / PATH PORTABILITY"
Run "Absolute Windows paths" "grep -rnE '[A-Za-z]:\\\\|C:\\\\|D:\\\\' src/ electron/"

Section "20. ASSETS"
Run "Assets inventory" "find public -type f -exec ls -lh {} +"

Section "21. GIT STATE"
Run "Git status" "git status --short || echo 'Not a git repository'"

Section "22. BUILD ARTIFACTS"
Run "Dist folder" "ls -lh dist release build 2>/dev/null || echo 'No build output yet'"

Section "23. INSTALLER ARTIFACTS"
Run "EXE files" "find . -name '*.exe' -o -name '*.msi'"

Section "24. WINDOWS DEPLOYMENT READINESS"
Run "Electron dependencies" "npm ls electron electron-builder electron-forge || true"

Section "29. AUTOMATED FINAL STATUS"
Run "Automated Checks" "
[ -f package.json ] && echo 'package.json: PASS' || echo 'package.json: FAIL'
[ -d node_modules ] && echo 'node_modules: PASS' || echo 'node_modules: FAIL'
[ -f tsconfig.json ] && echo 'tsconfig: PASS' || echo 'tsconfig: WARN'
[ -d .git ] && echo 'git: PASS' || echo 'git: WARN'
(ls electron-builder* >/dev/null 2>&1 || ls forge.config* >/dev/null 2>&1) && echo 'installer config: PASS' || echo 'installer config: WARN'
"

echo "$REPORT"
