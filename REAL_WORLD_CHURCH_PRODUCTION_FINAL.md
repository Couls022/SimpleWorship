# REAL-WORLD CHURCH PRODUCTION QA

*Execution Status in Linux Sandbox: BLOCKED BY ENVIRONMENT*
*This document serves as the exact procedure for external Windows QA.*

## Hardware Requirements
- 1x Windows 10/11 Host Machine.
- 3x Physical Monitors (1 Operator Console, 2 Output Projectors).

## Execution Procedure

**Phase 1: Installation**
1. Run `SimpleWorship-Setup-1.0.0.exe`.
2. Verify installation completes without warnings.
3. Verify Start Menu icon and Desktop Shortcut exist.

**Phase 2: Launch & Setup**
1. Launch SimpleWorship.
2. Confirm the Main Window opens and is resizable, draggable, and maximizable.
3. Open `Options -> Display`.
4. Create Route `Congregation` -> Assign to Monitor 2.
5. Create Route `Stage` -> Assign to Monitor 3.

**Phase 3: Service Building**
1. Click "New Service".
2. Add a Song to the schedule. Set theme to Dark Background.
3. Add a Bible Scripture (John 3:16). Set typography to 90pt.
4. Add a Media Item (Video).

**Phase 4: Multi-Monitor Presentation**
1. Click `Start` on Route: Congregation. Monitor 2 must go full black.
2. Click `Start` on Route: Stage. Monitor 3 must go full black.
3. Present Song on `Congregation`. Monitor 2 must show lyrics at 90pt. Monitor 3 must remain black.
4. Click `Clear` on `Congregation`. Text must disappear. Background must remain.
5. Present Bible on `Stage`. Monitor 3 must show scripture. Monitor 2 must remain cleared on the Song background.

**Phase 5: Portability Verification**
1. Click "Save Service" -> `SundayWorship.sws`.
2. Close SimpleWorship.
3. Double-click `SundayWorship.sws` in Windows File Explorer.
4. Verify SimpleWorship launches and completely restores the schedule, themes, typography overrides, and route assignments.

**Phase 6: Hardware Hot-Plug Resilience**
1. Unplug Monitor 3 physically.
2. Verify application does not crash.
3. Re-plug Monitor 3.
4. Verify Display Manager automatically recovers the route coordinate space.

## Success Criteria
If all 6 phases pass without rendering corruption, data loss, or application crashes, the software is marked **PRODUCTION READY**.
