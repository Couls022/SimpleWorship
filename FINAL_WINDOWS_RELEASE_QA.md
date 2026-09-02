# SimpleWorship RC-3: Final Windows Production Release QA Procedure

**Release Stage:** Release Candidate — RC-3  
**Target Platform:** Windows 10 / Windows 11 (x64)  
**Binary Output:** `SimpleWorship-Setup-1.0.0.exe`  
**Document Classification:** Physical Execution Runbook  

---

## 1. System Overview & Pre-Requisites

SimpleWorship is a standalone, offline-first, no-account, multi-display worship presentation application. The native shell is built on Electron 30 with a hardened security posture (`contextIsolation: true`, `nodeIntegration: false`).

### Minimum Hardware & Environment Baseline
* **OS:** Windows 10 (Build 19041+) or Windows 11 (64-bit)
* **Processor:** Intel Core i5 / AMD Ryzen 5 or higher
* **Memory:** 8 GB RAM minimum (16 GB recommended for 4K video)
* **Graphics:** Dedicated or high-tier integrated GPU with multi-display support (DisplayPort / HDMI)
* **Displays:** Primary Operator Monitor (1080p minimum) + 1 to 4 Projector / Stage Displays

---

## 2. Windows Clean Installation QA Procedure

Execute the following test steps on a clean Windows machine without prior SimpleWorship installations:

### Step 1: Installer Execution
1. Double-click `SimpleWorship-Setup-1.0.0.exe`.
2. Verify the NSIS installation wizard displays:
   - Application Name: **SimpleWorship**
   - Version: **1.0.0**
   - Default install directory: `C:\Program Files\SimpleWorship`
   - Option to customize installation path.
3. Complete installation and verify:
   - Desktop shortcut `SimpleWorship.lnk` is created with the SimpleWorship brand emblem.
   - Start Menu shortcut is created under `SimpleWorship`.
   - Windows Registry assigns `.sws` file extension to `SimpleWorship.exe`.

### Step 2: First Launch & Window Management
1. Launch SimpleWorship from Desktop.
2. Verify main window characteristics:
   - Starts at 1440x900 resolution centered on Primary display.
   - Window borders permit smooth horizontal and vertical resizing.
   - Maximize, Restore, and Minimize buttons operate instantly.
   - Dragging title bar moves the window seamlessly across monitors with different DPI scalings.
   - Minimum window constraints enforce 1024x700 without layout clipping.

### Step 3: Single-Instance Enforcement & File Association
1. While SimpleWorship is open, double-click a `.sws` file in Windows File Explorer.
2. **Verify:** A second application instance does NOT spawn (`requestSingleInstanceLock` captures event).
3. **Verify:** The existing SimpleWorship window restores from taskbar, focuses, and loads the `.sws` service rundown.
4. Close SimpleWorship completely.
5. Double-click the `.sws` file again.
6. **Verify:** SimpleWorship cold-boots and opens the specified service package directly.

---

## 3. Physical Workspace Interaction QA

| Feature | Action | Expected Physical Result | Status |
| :--- | :--- | :--- | :--- |
| **Horizontal Splitter** | Drag split bar between Schedule and Live Monitor | Schedule width resizes smoothly from 15% to 40% of viewport. | IMPLEMENTED + NOT VERIFIED |
| **Vertical Splitter** | Drag split bar between Top Presentation Area and Bottom Resources | Bottom panel expands and collapses with exact percentage persistence. | IMPLEMENTED + NOT VERIFIED |
| **Panel Docking** | Click "Pop Out" on Live Output monitor | Live Panel detaches into a floating, draggable window over canvas. | IMPLEMENTED + NOT VERIFIED |
| **Panel Re-docking** | Click "Dock" on floating window header | Window snaps back into the top grid at its prior slot. | IMPLEMENTED + NOT VERIFIED |
| **Workspace Reset** | Select `View -> Reset Workspace Layout` | UI reverts to factory default 4-pane layout with 0 service data loss. | IMPLEMENTED + NOT VERIFIED |

---

## 4. Uninstall & Data Integrity QA

1. Open `Windows Settings -> Installed Apps -> SimpleWorship -> Uninstall`.
2. Run uninstaller to completion.
3. **Verify:**
   - `C:\Program Files\SimpleWorship` is cleanly removed.
   - Desktop and Start Menu shortcuts are removed.
   - User-created `.sws` files in `Documents` or `Desktop` are **PRESERVED** and **NEVER deleted**.
   - IndexedDB local databases remain intact unless explicitly wiped by user.
