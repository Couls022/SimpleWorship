# MULTI-MONITOR PHYSICAL QA MATRIX

## 1. Test Hardware Specifications
- **Host**: Windows 10/11 Desktop / Laptop with multi-head GPU (HDMI / DisplayPort / USB-C DP Alt Mode)
- **Monitors Under Test**: 1 to 4+ Physical Displays
- **Resolutions Tested**: 1920×1080 (FHD), 2560×1440 (QHD), 3840×2160 (4K UHD)
- **Windows Display Scale Factors**: 100%, 125%, 150%, 200%

---

## 2. Test Cases & Execution Matrix

### Test 1: Single Monitor (Control Screen Only)
- **Setup**: 1 Physical Monitor.
- **Action**: Launch Projector on Monitor 1 or windowed preview.
- **Expected**: Projector canvas respects 16:9 aspect ratio; warning provided if covering control window.
- **Classification**: IMPLEMENTED (Code) + NOT VERIFIED (Physical Windows Host)

### Test 2: Dual Monitors (Operator + Congregation)
- **Setup**: Monitor 1 (Operator UI, 1080p 125%), Monitor 2 (Congregation Projector, 1080p 100%).
- **Action**: Map Route A to Monitor 2. Advance slides on Song and Scripture.
- **Expected**: Fullscreen borderless window opens at exact coordinates of Monitor 2 (`x: 1920, y: 0`). Slide changes update instantaneously with zero lag.
- **Classification**: IMPLEMENTED (Code) + NOT VERIFIED (Physical Windows Host)

### Test 3: Triple Monitors (Operator + Congregation + Stage Display)
- **Setup**: Monitor 1 (Operator), Monitor 2 (Congregation), Monitor 3 (Stage Display).
- **Action**:
  - Map Route A ("Congregation") to Monitor 2.
  - Map Route B ("Stage Display") to Monitor 3.
  - Advance Route A on a Worship Song. Advance Route B on a Bible Passage or Next Slide Cue.
- **Expected**: Complete independence between Route A and Route B. Changing Route A does NOT alter Route B. Toggling Black (`BLK`) or Clear (`CLR`) on Route A does NOT blackout Route B.
- **Classification**: IMPLEMENTED (Code) + NOT VERIFIED (Physical Windows Host)

### Test 4: Same-Route Multi-Display Duplication (1 Route → 2+ Monitors)
- **Setup**: Monitor 1 (Operator), Monitor 2 (Main Sanctuary Left), Monitor 3 (Main Sanctuary Right).
- **Action**: Map Route A to both Monitor 2 and Monitor 3.
- **Expected**: Both physical projectors open and display the exact same slide content synchronized via native BroadcastChannel with identical timing.
- **Classification**: IMPLEMENTED (Code) + NOT VERIFIED (Physical Windows Host)

### Test 5: Hot-Plug Disconnect & Reconnect Recovery
- **Setup**: Active projection on Monitor 2.
- **Action**:
  1. Unplug video cable from Monitor 2 while slide is live.
  2. Wait 5 seconds.
  3. Reconnect video cable to Monitor 2.
- **Expected**:
  - Disconnect: Electron receives `display-removed`; application continues running without unhandled crash. UI flags target as disconnected.
  - Reconnect: Electron receives `display-added`; monitor can be re-bound and projection resumed.
- **Classification**: IMPLEMENTED (Code) + NOT VERIFIED (Physical Windows Host)

### Test 6: 16:9 Projection Canvas Geometry
- **Setup**: 16:9, 16:10, and ultrawide projector/monitors.
- **Action**: Project slides with background video, centered title, lyrics, and scripture reference.
- **Expected**: Slide content scales with optical letterboxing if aspect ratio differs; no stretching, distortion, or cropped text.
- **Classification**: IMPLEMENTED + VERIFIED (Renderer & Canvas Engine)
