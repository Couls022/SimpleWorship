# SWS FORMAT SPECIFICATION (v1.0)

## OVERVIEW
The `.sws` (SimpleWorship Service) file is the native, portable, self-contained project format for SimpleWorship. It encapsulates a complete worship service, including the order of service (schedule), custom presentation data, route targeting configs, and (optionally) bundled media assets.

## FORMAT STRUCTURE
A `.sws` file is fundamentally a **ZIP archive** (uncompressed or DEFLATE) containing a standardized directory structure and JSON manifests.

### Directory Layout
```text
Service.sws (ZIP Archive)
│
├── manifest.json         # Package metadata and versioning
├── service.json          # The core schedule, routes, and inline content
├── themes.json           # Theme definitions used in this service
└── assets/               # Bundled binary media files
    ├── [hash-1].mp4
    ├── [hash-2].jpg
    └── [hash-3].pptx
```

## SCHEMA DEFINITIONS

### 1. `manifest.json`
Ensures version compatibility and tracks package generation.
```json
{
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "serviceId": "uuid-v4",
  "createdAt": "2026-08-31T12:00:00Z",
  "modifiedAt": "2026-08-31T12:00:00Z",
  "assetStrategy": "bundled" // "bundled" | "referenced"
}
```

### 2. `service.json`
Contains the actual presentation ordering and embedded textual content (Songs, Bible references, Announcements).
```json
{
  "metadata": {
    "title": "Sunday Morning Service",
    "date": "2026-09-06"
  },
  "schedule": {
    "id": "schedule-uuid",
    "items": [
      {
        "id": "item-1",
        "type": "song",
        "name": "Amazing Grace",
        "data": { ... },
        "themeOverrideId": "theme-1"
      }
    ]
  },
  "routes": {
    "group-1": {
      "name": "Main Projector",
      "preferredDisplayIds": ["display-id-1"]
    }
  }
}
```

### 3. `themes.json`
Contains all themes referenced by the items in `service.json`. Ensures the visual aesthetic remains identical when opened on a different machine.

## ASSET STRATEGY & DEDUPLICATION
1. **Packaging**: When saving a `.sws`, the app scans the `schedule` for all referenced `backgroundUrl` or media `url` properties pointing to internal IndexedDB assets.
2. **Bundling**: These binaries are exported from IndexedDB and placed into the `/assets/` folder of the ZIP. The filename is the `SHA-256` hash of the file.
3. **Restoration (Import)**:
   - When a `.sws` is opened, the `SwsManager` computes the hashes of incoming assets.
   - It checks the local IndexedDB.
   - **Collision Handling**: If the hash already exists locally, the bundled asset is IGNORED (deduplication). The service updates its internal references to point to the existing local asset ID.
   - If the hash is new, it is inserted into the local IndexedDB.

## VALIDATION & SECURITY
Before parsing, the importer MUST:
1. Verify the file signature (PKZIP `50 4B 03 04`).
2. Verify `manifest.json` exists and `formatVersion` is `<= CURRENT_SUPPORTED_VERSION`.
3. Ensure no single asset exceeds the `MAX_ASSET_SIZE` (e.g., 500MB) to prevent RAM exhaustion during Zip decompression.
4. Strip any executable payloads (`.exe`, `.js`, `.bat`) found inside the `/assets/` directory.

## MIGRATION STRATEGY
If `formatVersion` > 1 in the future, `SwsManager` will execute sequential migration functions (e.g., `migrateV1toV2(rawJson)`) before injecting the data into the Zustand store.
