# SimpleWorship RC-3: Real-World Church Presentation QA & Long-Run Stability

**Scenario:** Complete Sunday Morning Worship Service Simulation  
**Duration:** 2-Hour Continuous Live Projection  
**Target Environment:** Windows 10 / 11 Native Desktop  
**Operator Persona:** Volunteer Church AV Technician  

---

## 1. 2-Hour Sunday Service Simulation Protocol

This QA test protocol reproduces an end-to-end multi-segment church service without interruption:

### Phase 1: Pre-Service Rundown Setup (T-15 min)
1. Launch SimpleWorship.
2. Open `OpenScheduleModal` -> Drag & drop `Sunday-Morning-Worship.sws`.
3. Verify all schedule items load in order:
   - Item 1: **Pre-Service Countdown Video** (5 min loop)
   - Item 2: **Opening Call to Worship** (Scripture: Psalm 100:1-5)
   - Item 3: **Praise Song 1** (4 verses + 2 choruses)
   - Item 4: **Praise Song 2** (3 verses + bridge + chorus)
   - Item 5: **Welcome & Announcements** (Image slide)
   - Item 6: **Sermon Scripture** (Passage: Romans 8:28-39)
   - Item 7: **Sermon Presentation** (PowerPoint / Slide Deck)
   - Item 8: **Response Song** (Closing worship)
   - Item 9: **Benediction & Dismissal Video**
4. Configure Display Routes:
   - Route 1: Sanctuary Main Projectors (Monitors 2 & 3)
   - Route 2: Stage Confidence Monitor (Monitor 4)
5. Click **"Launch All Projectors"**. Verify fullscreen activation on all external displays.

---

### Phase 2: Live Worship Service Execution (T+0 to T+90 min)

| Timeline | Action | Expected Output Behavior |
| :--- | :--- | :--- |
| **00:00 - 05:00** | Play Pre-Service Countdown Video | Video loops smoothly with zero audio popping or dropped frames. |
| **05:00 - 15:00** | Transition to Opening Call to Worship (Scripture) | 90pt canonical font renders centered with high contrast text shadow. |
| **15:00 - 35:00** | Present Praise Songs 1 & 2 (Rapid slide cueing) | Arrow keys advance slides smoothly; Live monitor updates synchronously. |
| **35:00 - 40:00** | Press `B` (Black Screen) during Pastoral Prayer | Projector fades to pure `#000000`; stage monitor remains active. |
| **40:00 - 41:00** | Press `B` again to restore presentation | Slide restores instantly without re-triggering entrance glitch. |
| **41:00 - 45:00** | Press `C` (Clear Text) during Scripture Reflection | Background image/video remains visible while lyrics text clears cleanly. |
| **45:00 - 75:00** | Present Sermon Scripture & Slide Deck | Multi-verse scripture pagination formats correctly; text wraps cleanly. |
| **75:00 - 85:00** | Broadcast Urgent Alert: "Nursery: Child 402" | Alert ribbon scrolls across top of Congregation display without displacing lyrics. |
| **85:00 - 90:00** | Closing Song & Post-Service Video | Smooth cross-fade into closing video loop. |

---

## 2. 2-Hour Stress & Resource Leakage Benchmarks

During the 2-hour continuous test execution, monitor and record workstation system metrics:

| Metric | Threshold Baseline | Target Limit | QA Physical Result | Status |
| :--- | :---: | :---: | :---: | :---: |
| **CPU Usage (Idle)** | < 3% | < 5% | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
| **CPU Usage (Active Video)** | < 15% | < 25% | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
| **RAM Consumption** | ~180 MB | < 450 MB (No Leak) | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
| **GPU Acceleration** | Hardware D3D11 | Active Decode | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
| **Projector Sync Drift** | < 16 ms | < 33 ms | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
| **Renderer Crash Count** | 0 | 0 | Pending Hardware Test | IMPLEMENTED + NOT VERIFIED |
