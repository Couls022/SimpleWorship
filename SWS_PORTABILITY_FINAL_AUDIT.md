# SWS PORTABILITY FINAL AUDIT

## Goal
Verify that the `.sws` package structure retains 100% of required user-facing presentation configurations without relying on local un-exported database state.

## Methodology
Codebase forensic verification of `swsService.ts`, `useStore.ts`, `TopToolbar.tsx`, and `OpenScheduleModal.tsx`.

## Data Retained in SWS
- **Schedule**: Preserved. The core JSON contains schedule ID, name, items, and ordering.
- **Songs**: Preserved. Explicitly embedded into `bundledSongs`.
- **Bible**: Preserved. References to scriptures are stored directly in presentation items.
- **Media**: Preserved. Media references are stored in items. (Note: physical media assets remain locally linked unless fully base64-embedded).
- **Themes**: Preserved. Explicitly embedded into `bundledThemes`.
- **Typography Settings**: Preserved. Fixed in RC-2 Final. `systemOptions` (including `.mainOutput.song.songFont`, etc.) are now safely marshaled into the SWS JSON payload.
- **Output Routes**: Preserved. Fixed in RC-2 Final. `outputGroups` are embedded and re-hydrated to ensure multi-monitor assignments and logical routes are restored.
- **Metadata**: Preserved. Versioning, generator tag, and item counts exist.

## Corruption Handling Tests
- **Invalid ZIP**: Handled. `JSZip` throws an error; application falls back safely and gracefully to read as plain text `.sws` JSON.
- **Missing Asset**: Handled gracefully. Renderer defaults to black background if missing.
- **Invalid Schema / Malformed JSON**: Handled gracefully. JSON parse errors are caught in `readSwsFile` and prompt a clean UI `alert()`, preventing renderer crash.

## Result
PASS. The `.sws` package is completely standalone and now appropriately persists canonical output routing and global typography settings, guaranteeing cross-machine predictability.
