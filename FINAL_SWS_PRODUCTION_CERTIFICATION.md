# SimpleWorship RC-3: Final SWS Production Certification & Data Preservation Audit

**File Format Specification:** SimpleWorship Service Package (`.sws`)  
**Package Standard:** ZIP Container / DEFLATE Compression + Structured Manifest  
**Version:** 1.0.0  
**Target Integrity:** Zero Meaningful Service-State Loss  

---

## 1. SWS Architecture & Contract Verification

The `.sws` format is the **sole, mandatory user-facing service format** for SimpleWorship. Direct JSON files are restricted to internal package manifests and are never exposed as the default user save/open target.

### Internal SWS Package Layout
```text
MyService.sws (ZIP Container)
├── manifest.json       (Package version, UUID, timestamp, schema version)
├── schedule.json       (Schedule items, songs, scripture, themes, outputGroups, systemOptions)
├── icon.svg            (SimpleWorship vector emblem for desktop shell renderers)
├── icon.png            (Raster icon preview)
├── preview.svg         (Vector preview summary rundown)
├── README.txt          (Human-readable archive metadata)
└── assets/             (Bundled media assets: background images, video clips, motions)
```

---

## 2. Complete State Preservation Matrix

| State Attribute | Serialized in SWS | Restored on Load | Verification Check |
| :--- | :---: | :---: | :--- |
| **Service Title & Metadata** | ✅ Yes | ✅ Yes | Restores title, creation date, rundown order |
| **Schedule Item IDs & Ordering** | ✅ Yes | ✅ Yes | Strict sequence preservation without reshuffling |
| **Full Song Content & Overrides** | ✅ Yes | ✅ Yes | Bundled in `bundledSongs`, retains verse tags & lines |
| **Scripture Verses & References** | ✅ Yes | ✅ Yes | Text, translation code, and verse ranges preserved |
| **90pt Typography Contract** | ✅ Yes | ✅ Yes | Preserved in `systemOptions.mainOutput.song` & `.scripture` |
| **Output Groups Configuration** | ✅ Yes | ✅ Yes | Preserved in `outputGroups` (routing IDs & names) |
| **Display Target Bindings** | ✅ Yes | ✅ Yes | Restores monitor IDs and logical route mapping |
| **Cascading Themes** | ✅ Yes | ✅ Yes | Preserved in `bundledThemes` & `themeOverride` |
| **Media Assets & References** | ✅ Yes | ✅ Yes | Packaged in `assets/` folder with UUID hash deduplication |

---

## 3. Corruption & Security Hardening Tests

| Test Case | Attack / Fault Vector | Expected Result | Verified Result |
| :--- | :--- | :--- | :---: |
| **Zip Slip Traversal** | Archive contains `../../etc/passwd` or `..\..\calc.exe` | Rejected; paths sanitized to basename only. | **PASS** (Unit Tested) |
| **Missing Manifest** | Archive lacks `manifest.json` | Throws `Missing manifest.json`; graceful UI error alert. | **PASS** (Unit Tested) |
| **Corrupted JSON** | Syntax errors or truncated byte stream in `service.json` | Rejection with descriptive alert; no renderer crash. | **PASS** (Unit Tested) |
| **Future Version** | `formatVersion: 999` in manifest | Throws `Unsupported .sws version`; guides user to update. | **PASS** (Unit Tested) |
| **Missing Asset** | Schedule references an asset not present in `assets/` | Asset placeholder rendered; presentation core remains stable. | **PASS** (Unit Tested) |

---

## 4. Round-Trip Verification Test

* **Test Artifact:** `FINAL-QA-Service.sws`
* **Test Contents:**
  - 3 Songs (Amazing Grace, 10,000 Reasons, Great Are You Lord)
  - 2 Scripture Passages (John 3:16-17, Psalm 23:1-6)
  - 1 Background Motion (Looping MP4)
  - 1 High-Resolution Background Image (JPEG)
  - Custom Theme (Cyan Accent, Center Aligned, 90pt Base)
  - 3 Output Groups (Congregation, Stage Confidence, Live Stream)
* **Execution:**
  1. Save `FINAL-QA-Service.sws` via `TopToolbar -> Save As`.
  2. Clear in-memory session via `New Schedule`.
  3. Load `FINAL-QA-Service.sws` via `OpenScheduleModal`.
* **Outcome:**
  - Schedule item count: 5/5 preserved.
  - Song lyrics & slide boundaries: Exact match.
  - Scripture verses: Exact match.
  - 90pt canonical typography: Intact across all output routes.
  - **Data Loss: ZERO.**
