# WINDOWS INSTALLATION & DEPLOYMENT TEST SUITE

## 1. Prerequisites
- **Target OS**: Windows 10 (64-bit) / Windows 11 (64-bit)
- **Node.js**: v18+ / v20+ with npm
- **Target Artifact**: `SimpleWorship-Setup-1.0.0.exe` (Generated in `dist-electron/`)
- **Unpacked Target**: `SimpleWorship.exe`

---

## 2. Canonical Production Build Command
On a Windows 10/11 physical machine, run:
```powershell
npm install
npm run build
npm run electron:build
```
*Note: `npm run electron:build` runs `electron-builder --win nsis --x64` using canonical metadata from `package.json`.*

---

## 3. End-to-End Test Procedure

### Phase A: Clean Installation & OS Registration
1. **Execute Installer**: Run `SimpleWorship-Setup-1.0.0.exe`.
2. **Installation Wizard**: Verify the NSIS setup wizard displays "SimpleWorship", allows choosing custom installation directory, and completes without errors.
3. **Start Menu**: Verify "SimpleWorship" appears in Windows Start Menu with the cyan emblem icon.
4. **Desktop Shortcut**: Verify "SimpleWorship" shortcut appears on Desktop.
5. **Taskbar**: Launch app and verify taskbar icon displays the official logo and groups properly.
6. **Application Identity**: Verify window title, About info, and Task Manager process name show `SimpleWorship`.

### Phase B: SWS Service File Association
7. **File Association Verification**: Verify `.sws` files in Windows Explorer have the SimpleWorship icon and "SimpleWorship Service Package" description.
8. **Cold Start by Double-Click**:
   - Double-click `Sunday Worship.sws` with SimpleWorship closed.
   - Verify SimpleWorship opens directly and automatically loads the schedule, songs, bibles, and routes.
9. **Warm Start (Existing Instance Handoff)**:
   - With SimpleWorship already open, double-click another `.sws` file in Explorer.
   - Verify no second process is created (single-instance lock); the running window restores, focuses, and loads the new service.

### Phase C: Data Integrity & Unsaved Changes Protection
10. **Create New Service**: Click "New Service", add 3 songs, 2 scripture references (e.g. Psalm 23), and 1 background video.
11. **Save Service**: Press `Ctrl+S` or click Save. Verify native Windows Save Dialog defaults to `Sunday Worship.sws`.
12. **Close & Reopen**: Close app, relaunch, and open `Sunday Worship.sws`. Verify all items, verse text, custom themes, and route configurations are restored bit-for-bit.
13. **Unsaved Changes Prompt**: Modify a slide, attempt to close the application or open a new service. Verify Save / Discard / Cancel prompt prevents silent data loss.

### Phase D: Multi-Monitor & Projector Execution
14. **Display Enumeration**: Verify all connected monitors (1, 2, 3, 4+) appear in Output Routing settings.
15. **Full Projector Launch**: Launch Route A to Monitor 2. Verify borderless, full 16:9 canvas at native resolution (1080p, 1440p, 4K) across Windows DPI scaling factors (100%, 125%, 150%, 200%).
16. **Route Duplication**: Assign Route B to Monitor 2 and Monitor 3. Verify both physical displays render identical synchronized output.
17. **Hot-Plug / Cable Disconnect**: Unplug HDMI cable during active projection. Verify the app does not crash and recovers upon reconnection.

### Phase E: Upgrade & Clean Uninstall
18. **In-Place Upgrade**: Install updated version over existing installation. Verify user data in IndexedDB remains intact.
19. **Uninstall**: Run uninstaller from Windows "Installed Apps". Verify application binaries are cleanly removed while preserving user-saved `.sws` files on disk.
