# SIMPLEWORSHIP SERVICE PACKAGE (.SWS) — FINAL CERTIFICATION

## 1. File Format Architecture Specification

A `.sws` package is a standardized, compressed ZIP container adhering to the SimpleWorship Service Protocol v1.0.

### Internal Archive Structure
```text
Sunday Worship.sws
├── manifest.json         # Package metadata, versioning, checksums, asset strategies
├── service.json          # Complete schedule state, item ordering, theme references, route mappings
└── assets/               # Bundled binary media files (images, video loops, presentation assets)
    ├── asset-001_worship_bg.jpg
    └── asset-002_welcome_loop.mp4
```

---

## 2. Forensic Test Matrix for .sws Operations

| Test Case | Scenario | Expected Behavior | Actual Observed Outcome | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **SWS-01** | Export Service with songs & media | Valid compressed archive generated with manifest.json | Archive created with valid JSON manifests and media folder | **PASS** |
| **SWS-02** | Import Service into clean session | Schedule, themes, and item ordering restored | All 8 liturgical items correctly loaded into schedule | **PASS** |
| **SWS-03** | Import corrupt archive (missing manifest) | Reject file with structured error dialog | Caught with `Invalid .sws file: Missing manifest.json` | **PASS** |
| **SWS-04** | Import forward-versioned package (v999) | Reject gracefully and notify user to update software | Caught with `Unsupported .sws version: 999` | **PASS** |
| **SWS-05** | Asset Deduplication | Avoid duplicating existing assets in IndexedDB | Existing binary assets preserved via SHA/filename index | **PASS** |
| **SWS-06** | File Association Open (`second-instance`) | Open .sws via command line arguments in Electron shell | `electronAPI.onFileAssociationOpened` dispatches load event | **PASS** |

---

## 3. Security & Integrity Protections
- **Zip Slip Mitigation**: Path traversal sequences (`../`, absolute paths) are stripped when unpacking archive contents.
- **Payload Validation**: Strict schema verification on `manifest.json` and `service.json` before parsing into application memory.
