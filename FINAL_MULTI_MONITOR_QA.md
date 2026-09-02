# SimpleWorship RC-3: Final Multi-Monitor & Routing QA Matrix

**Subsystem:** Native Display Routing & Projector Window Management  
**Engine:** Electron Native Screen API + Cross-Window Synchronization  
**Document Type:** Multi-Display Hardware Validation Protocol  

---

## 1. Output Routing Architecture

SimpleWorship provides an unconstrained **Logical Route to Physical Display** mapping matrix:
* **No Artificial Monitor Limits:** Supports 1, 2, 3, 4, 5, or more connected physical displays.
* **Many-to-One Binding:** A single logical route (e.g., Congregation) can broadcast simultaneously to multiple physical displays (e.g., Projector Left + Projector Right + Overflow Display).
* **Independent Route State:** Each logical route maintains independent state for:
  - Active Content Item
  - Current Slide Index
  - Visual Theme / Background Layer
  - Black Screen Toggle (`isBlack`)
  - Clear Text Toggle (`isClear`)
  - Alert Banner Overlays

```text
[ Logical Output Route A: Main Sanctuary ] ──┬──> [ Monitor 2: Sanctuary Center Projector ]
                                             └──> [ Monitor 3: Sanctuary Side Display ]

[ Logical Output Route B: Stage Confidence ] ─────> [ Monitor 4: Vocalist Floor Wedge ]

[ Logical Output Route C: Stream / Broadcast ] ───> [ Monitor 5: NDI / Video Capture Feed ]
```

---

## 2. Multi-Display Physical QA Matrix

Execute the following test configurations on physical Windows workstations:

| Configuration | Hardware Setup | Test Actions | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **1 Monitor** | Single Laptop / Desktop Display | Enable Projector Preview in Workspace | Preview renders inside Moderator window; no off-screen errors. | IMPLEMENTED + NOT VERIFIED |
| **2 Monitors** | 1 Primary + 1 External Projector | Route A assigned to Monitor 2; Click "Go Live" | Fullscreen borderless window opens on Monitor 2 at 16:9 aspect. | IMPLEMENTED + NOT VERIFIED |
| **3 Monitors** | 1 Primary + 2 External Displays | Route A -> Mon 2, Route B -> Mon 3; Advance slides | Route A shows congregation slide; Route B shows stage confidence. | IMPLEMENTED + NOT VERIFIED |
| **4 Monitors** | 1 Primary + 3 External Displays | Route A -> Mon 2 & 3, Route B -> Mon 4 | Monitors 2 & 3 mirror Route A in sync; Mon 4 shows Route B. | IMPLEMENTED + NOT VERIFIED |
| **5+ Monitors** | 1 Primary + 4+ Multi-Outputs | All routes populated with distinct targets | Zero frame drops; BroadcastChannel synchronizes all windows. | IMPLEMENTED + NOT VERIFIED |

---

## 3. Projector Window Quality Standards

Projector output windows must meet the following strict production criteria:
1. **Window Frame:** Completely borderless (`frame: false`).
2. **Bounds & Alignment:** Exactly matches the target monitor's bounds (`x`, `y`, `width`, `height`).
3. **Screen Coverage:** True fullscreen (`fullscreen: true`) with `alwaysOnTop: true`.
4. **Taskbar Behavior:** Clean presentation mode; no window title bar or OS taskbar bleed.
5. **Canvas Ratio:** Locked 16:9 canvas with background letterboxing on non-standard aspect ratios.
6. **Scrollbars:** Accidental horizontal or vertical scrollbars strictly eliminated (`overflow: hidden`).

---

## 4. Display Hot-Plug & Fault Tolerance QA

| Fault Condition | Trigger Action | Expected System Reaction | Status |
| :--- | :--- | :--- | :---: |
| **Cable Disconnect** | Unplug HDMI cable from Monitor 2 while Live | Electron catches `display-removed`; route remains logically active. | IMPLEMENTED + NOT VERIFIED |
| **Cable Reconnect** | Re-insert HDMI cable | Electron catches `display-added`; monitor re-appears in target list. | IMPLEMENTED + NOT VERIFIED |
| **Resolution Switch** | Change Windows display resolution from 1080p to 4K | Electron catches `display-metrics-changed`; canvas adapts instantly. | IMPLEMENTED + NOT VERIFIED |
