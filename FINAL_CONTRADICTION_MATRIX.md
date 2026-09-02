# FINAL CONTRADICTION MATRIX

| CLAIM (From previous audits) | ACTUAL CODE | ACTUAL TEST | EVIDENCE | CORRECT STATUS | ACTION REQUIRED |
| :--- | :--- | :--- | :--- | :--- | :--- |
| User can save as `.json` | Save dialogs restrict to `.sws`. Import restricted to `.sws`. | TopToolbar.tsx & main.cjs | File dialog filters strictly set to `extensions: ['sws']`. | IMPLEMENTED + VERIFIED | None (Fixed in this run). |
| Route configs preserved | Previously missing from SWS encoding. | `swsService.ts` | Code lacked `systemOptions` and `outputGroups` mapping. | IMPLEMENTED + VERIFIED | Fixed in RC-2 Final. `outputGroups` now part of `SwsPackage`. |
| Typography settings preserved | Previously missing from SWS encoding. | `swsService.ts` | Code lacked `systemOptions` mapping. | IMPLEMENTED + VERIFIED | Fixed in RC-2 Final. `systemOptions` now part of `SwsPackage`. |
| PPTX has native graphics rendering | `pptx-react-viewer` implemented. | `PptxRenderOverlay.tsx` | Native Canvas slide rendering extracts text/shapes. No animations. | PARTIAL | Ensure documentation limits expectations regarding transitions/SmartArt. |
| Double-click SWS Open | Main process handles `second-instance`. | `electron/main.cjs` | Handles command-line arguments to pipe `argv` to active instance. | IMPLEMENTED + NOT VERIFIED | Requires physical Windows testing. |
| Crash Recovery | "Usually survives" | `useStore.ts` | `zustand/middleware/persist` and IDB caches working state reliably. | IMPLEMENTED + VERIFIED | None. |
| Windows Installer Verified | Stated as completed | Linux Sandbox | Cannot physically build/execute `.exe` locally on OS. | BLOCKED BY ENVIRONMENT | Must be marked pending QA. |
