# REAL-WORLD WORSHIP FINAL TEST PLAN — 2-HOUR SERVICE SIMULATION

## 1. Scenario Scope
Simulate a complete 2-hour multi-set Sunday morning church service with high-volume media switching, Bible reading, song navigation, independent stage monitor cues, and emergency broadcast ticker alerts.

---

## 2. Test Breakdown & Execution Checklist

| Phase | Action | Expected Output | Status |
|---|---|---|---|
| **00:00 - 00:15 (Pre-Service)** | Loop 1080p motion countdown video on Congregation route (Monitor 2). Background music playing. | Smooth infinite video loop without stutter or memory climbing. | BASELINE VERIFIED (Code/Browser) / NOT VERIFIED (2-hr physical run) |
| **00:15 - 00:20 (Welcome)** | Fire Announcement Graphic Slide with drop shadow text and church logo. | Seamless crossfade from video to image slide. | IMPLEMENTED + VERIFIED |
| **00:20 - 00:45 (Praise & Worship Set)** | Fire 4 consecutive songs (Amazing Grace, 10,000 Reasons, How Great Is Our God, Way Maker). Rapid `Next` / `Prev` / direct jump to Chorus and Bridge. | Zero latency, no stale text frames, clean typography with high-contrast outlines. | IMPLEMENTED + VERIFIED |
| **00:45 - 00:50 (Independent Stage Cue)** | Send "Pastor on stage in 2 mins" ticker message to Stage route (Monitor 3) while Congregation route displays Praise slide. | Stage display updates with cue ticker; Congregation display remains completely unchanged. | IMPLEMENTED + VERIFIED |
| **00:50 - 01:30 (Sermon & Scripture)** | Project Psalm 23:1-6, John 3:16-18, and Romans 8:28. Use `CLR` (Clear) during sermon points, `LOG` for logo, and `BLK` (Black) for video illustration transition. | Text disappears cleanly on `CLR` leaving background intact; pure black on `BLK`; instant restore on un-clear. | IMPLEMENTED + VERIFIED |
| **01:30 - 01:45 (Altar Call & Closing)** | Fire soft ambient looping motion background with Closing Hymn. | Stable GPU video decoder usage, memory footprint within steady bounds (< 400MB). | BASELINE VERIFIED (Code) / NOT VERIFIED (2-hr hardware run) |
| **01:45 - 02:00 (Post-Service & Save)** | Save service as `Sunday_Service_2026.sws`. Close app. Relaunch and open `Sunday_Service_2026.sws`. | All 4 songs, scripture passages, media references, and custom route assignments restore accurately. | IMPLEMENTED + VERIFIED |

---

## 3. Performance & Stability Criteria
- **Target Video Duration**: Continuous 2 hours
- **Memory Growth Threshold**: Memory footprint must stabilize and not exhibit monotonic unbounded leak.
- **CPU / GPU Target**: GPU hardware acceleration utilized without dropped presentation frames.
- **Classification**: BASELINE VERIFIED (Automated tests & code architecture) / NOT VERIFIED (2-Hour Physical Hardware Run).
