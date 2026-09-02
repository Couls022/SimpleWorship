# NATIVE DISPLAY MIGRATION REQUIREMENTS

As SimpleWorship moves into Phase 4 (Desktop Native Packaging), the web-browser constraints placed upon the Output Routing and Projector subsystem will be eliminated. To achieve true EasyWorship-class or ProPresenter-class performance, the future native shell (e.g., Tauri or Electron) must fulfill the following systemic requirements:

## 1. Display Enumeration
- **Requirement:** The shell must provide a native API to query all connected physical displays at runtime.
- **Data Needed:** Display ID, Bounds (X, Y, Width, Height), WorkArea, Scale Factor, and IsPrimary flag.
- **Why:** The Moderator panel needs to present an exact list of available physical monitors (e.g., "HDMI-1 (1920x1080)") to assign Output Routes.

## 2. Window Positioning & Fullscreen
- **Requirement:** The application must programmatically spawn hidden frameless windows, position them precisely on target monitor coordinates, and trigger borderless fullscreen mode without OS-level pop-up blockers or manual user dragging.
- **Why:** Currently, `window.open()` requires the user to drag the popup window to the correct monitor and press F11. Native shells eliminate this friction.

## 3. Monitor Identity & Memory
- **Requirement:** The shell must provide stable hardware identifiers for connected displays to persist route assignments.
- **Why:** If Route A targets "BenQ Projector (Display-2)", the application should remember this assignment even after a system reboot.

## 4. Hot-Plug Detection
- **Requirement:** The application must listen for OS-level display connection and disconnection events.
- **Why:** If an HDMI cable is unplugged, the app should notify the operator and gracefully tear down the assigned projector window, restoring it automatically upon reconnection.

## 5. Projector Lifecycle & Always-on-Top
- **Requirement:** Projector output windows should have configurations to be "Always on Top" and strictly borderless.
- **Why:** Prevents accidental pop-ups (e.g., Windows Updates, antivirus notifications) from interrupting a live worship service.

## 6. GPU & Media Acceleration Considerations
- **Requirement:** Native shells must allow configuration of underlying Chromium flags for hardware-accelerated video decoding.
- **Why:** Rendering 4K motion backgrounds with overlaid CSS shadows and text at 60FPS requires strict GPU composition.

## 7. IPC (Inter-Process Communication) 
- **Requirement:** While the current `BroadcastChannel` is elegant across browser tabs, the native implementation may need to migrate to `ipcRenderer` / `ipcMain` (Electron) or Tauri Events for faster and more reliable inter-window state synchronization.
- **Why:** Guaranteeing that "Go Live" actions hit the target window with absolute zero latency and no missed frames is critical for live production.

---

**STATUS:** PREPARATION DOCUMENT ONLY. 
DO NOT IMPLEMENT UNTIL INSTRUCTED.
