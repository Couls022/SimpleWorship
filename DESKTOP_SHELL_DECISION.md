# DESKTOP SHELL DECISION

## CONTEXT
SimpleWorship requires a native desktop shell to bypass browser limitations, specifically for:
1. Native display enumeration (detecting physical monitors, their bounds, and identity).
2. Advanced window management (spawning borderless, always-on-top projector windows on specific monitors without user drag-and-drop).
3. Display hot-plug detection.
4. Guaranteed offline capability and filesystem access for `.sws` packages.

## CANDIDATES EVALUATED
1. **Tauri** (Rust + WebView2 on Windows)
2. **Electron** (Node.js + Bundled Chromium)

## COMPARISON MATRIX

| Capability | Tauri | Electron |
| :--- | :--- | :--- |
| **Windows Support** | Excellent (Windows 10/11 via WebView2) | Excellent (Windows 7/10/11) |
| **Multi-Monitor APIs** | Good, but relies on Rust windowing crates (Tao/Wry) | **Superior**. Mature `screen` API exposes exact bounds, scaling, and hot-plug events out-of-the-box. |
| **Window Management** | Good, but complex to manage multi-window GPU contexts. | **Superior**. `BrowserWindow` handles complex media/transparent overlays seamlessly. |
| **GPU / Video Playback** | Relies on OS-level WebView2 codecs (can be inconsistent). | **Superior**. Predictable bundled Chromium codecs (MP4, WebM). Hardware acceleration is highly configurable via flags. |
| **Memory/App Size** | **Superior**. Tiny binaries (~10MB), low RAM footprint. | Heavy binaries (~150MB), higher RAM (multi-process V8). |
| **Filesystem / IPC** | Excellent via Rust commands. | Excellent via `ipcMain` / `ipcRenderer`. |
| **Worship/Media Stability** | Can struggle with heavy 4K video backgrounds + React state across windows. | Industry standard for media (ProPresenter, OBS overlays use similar Chromium bases). |

## DECISION: ELECTRON

**Rationale:**
For a worship presentation software, **stability, predictable video codec support, and flawless multi-monitor window management** vastly outweigh the benefits of a smaller application size. 

Electron's `screen` API provides exactly what SimpleWorship needs to implement Phase 4 routing:
- `screen.getAllDisplays()`
- `screen.on('display-added', ...)`
- `screen.on('display-removed', ...)`

Creating a borderless, fullscreen projector on "Monitor 3" in Electron is a trivial, battle-tested operation:
```javascript
const display = screen.getAllDisplays().find(d => d.id === targetId);
new BrowserWindow({ x: display.bounds.x, y: display.bounds.y, fullscreen: true });
```
Tauri's multi-window capabilities and video decoding consistency on older Windows machines present too high a risk for a live production environment.

## NEXT STEPS FOR NATIVE IMPLEMENTATION
1. Scaffold `electron/main.js` and `electron/preload.js`.
2. Implement `DisplayManager.ts` in the React frontend to communicate with Electron via `window.electronAPI`.
3. Configure `electron-builder` to generate `SimpleWorship-Setup.exe`.
