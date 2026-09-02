# SWS IMPLEMENTATION AUDIT

## 1. SWS IMPLEMENTATION CHECK
**Status: PARTIAL / DISCONNECTED**
The source code contains a file `src/core/SwsManager.ts`. It includes logic for:
- SWS serializer (using `jszip`)
- SWS parser
- SWS manifest & schema definition
- Asset bundling and deduplication extraction
However, this file is **completely disconnected from the User Interface**. No buttons, menus, or event handlers call these functions.

## 2. SWS FILE FORMAT
**Status: REAL STRUCTURED PACKAGE (IN LOGIC)**
The implementation in `SwsManager.ts` defines a true package format (ZIP-based). It includes:
- `manifest.json` (formatVersion, appVersion, serviceId, assetStrategy)
- `service.json` (metadata, schedule, routes)
- `assets/` (binary assets hashed and bundled)

## 3. SWS IS NOT RENAMED JSON
**Status: ZIP/PACKAGE CONTAINING STRUCTURED FILES (Type C)**
The `SwsManager.ts` logic treats `.sws` as a zipped package of assets and manifests, avoiding the limitation of a single JSON file.

## 4. SWS SAVE TEST
**Status: NOT IMPLEMENTED IN UI**
The actual `TopToolbar.tsx` component's "Save Schedule" button (`handleSaveSchedule`) still saves a pure JSON file (`schedule.json`). It does NOT invoke `SwsManager.exportService()`. The UI lacks any mechanism to save a `.sws` file.

## 5. SWS OPEN / IMPORT TEST
**Status: NOT IMPLEMENTED IN UI**
There is no UI hook or file input configured to accept `.sws` files and pass them to `SwsManager.importService()`.

## 6. SWS VALIDATION
**Status: IMPLEMENTED IN LOGIC / UNTESTABLE IN UI**
`SwsManager.ts` checks for `manifest.json` and throws graceful errors if the `formatVersion` is unsupported or if manifests are missing. However, because it cannot be triggered, the actual user experience is untested.

## 7. SWS VERSIONING
**Status: STORED AND CHECKED (IN LOGIC)**
`SwsManager.ts` declares `CURRENT_VERSION = 1` and validates incoming files against this variable.

## 8. SWS ASSET PACKAGING & DEDUPLICATION
**Status: EMBEDDED (IN LOGIC)**
The code iterates over `IndexedDB`, retrieves binary blobs, and injects them into the `assets/` folder of the ZIP. Upon import, it compares the filename (which strips the prefix) against existing local assets to prevent duplication.

## 9. SWS + DISPLAY ROUTES
**Status: INCOMPLETE**
The `SwsManager` interface mentions `routes?: Record<string, any>;` but the current export logic does not actually serialize physical route definitions into the `.sws` file.

## 10. FILE ASSOCIATION
**Status: NOT IMPLEMENTED**
There is no installer, and therefore no OS-level file association for `.sws` files. Double-clicking a `.sws` file on a machine will not launch SimpleWorship.

**CONCLUSION:** The `.sws` format is a theoretically sound logic class (`SwsManager.ts`) that has **NOT** been integrated into the application. The user cannot actually save or open a `.sws` file.
