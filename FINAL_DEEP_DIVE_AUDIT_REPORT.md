# SIMPLEWORSHIP - FINAL DEEP DIVE AUDIT REPORT

## 1. EXECUTIVE SUMMARY

**CURRENT STATUS: FUNCTIONAL BETA**

The SimpleWorship application is currently in a **Functional Beta** state. It possesses a highly modular, decoupled architecture capable of independent multi-route presentation targeting (the true hallmark of professional worship software). The core data model, state management (Zustand), and IndexedDB persistence are robust and well-implemented. However, the system relies on standard web browser windowing constraints (Projector popup windows) rather than native Desktop display routing, making it inherently vulnerable to browser sandbox limitations (pop-up blockers, hardware acceleration quirks, and window-focus issues).

While foundational engines for Songs, Bibles, Themes, and Schedules are functional, the system lacks automated testing entirely, lacks an offline packaging solution (Desktop native shell), and contains some rudimentary mock/seed data that has not been replaced by robust external APIs (e.g., CCLI SongSelect is UI-only).

## 2. REPOSITORY INVENTORY

*   **`/src/components/`**: Houses all UI components, including the workspace manager (`LayoutManager.tsx`), resource tabs (`SongsTab.tsx`, etc.), and control panels (`LivePanel.tsx`, `SchedulePanel.tsx`, `TopToolbar.tsx`).
*   **`/src/core/`**: Houses the critical business logic engines. `PresentationCore.ts` (resolves items to slides) and `ThemeEngine.ts` (CSS styling layers).
*   **`/src/db/`**: IndexedDB initialization, backup/restore logic (`backup.ts`), and seed data generation.
*   **`/src/store/`**: Global state management (`useStore.ts`) powered by Zustand, plus multi-window synchronization (`sync.ts`, `broadcastSync.ts`).
*   **`/src/utils/`**: Helper utilities including the custom `pptxParser.ts` and `keyboardShortcuts.ts`.

## 3. ARCHITECTURE DIAGRAM

```text
    [User Interface (ModeratorView, LivePanel, Resources, Schedule)]
                                 ↓
            [Zustand State Store (useStore.ts) + BroadcastSync]
                                 ↓
   [IndexedDB (songs, themes, assets, schedules, scriptures, outputGroups)]
                                 ↓
[PresentationCore (Generates Slide[] from activeItemId & Content Types)]
                                 ↓
   [ThemeEngine (Resolves Global -> Route -> Type -> Item Overrides)]
                                 ↓
        [Output Route / Group State (groupStates[groupId])]
                                 ↓
        [Live Output Panel (Moderator View Preview/Status)]  ↔  [Projector Window]
```

## 4. DEPENDENCY AUDIT

*   **ESSENTIAL**: `react`, `react-dom`, `zustand` (State), `idb` (Database), `lucide-react` (Icons), `react-resizable-panels` (Workspace).
*   **RISKY/BRITTLE**: `jszip` (Used for pure-text PPTX extraction - prone to breakage on complex PowerPoint files).
*   **BUILD/DEV**: `vite`, `esbuild`, `tailwindcss`, `tsx`, `typescript`.
*   **UNUSED/SUSPICIOUS**: `express`, `@google/genai` (Present in package.json but not heavily leveraged in the core offline workflow, indicates potential mixed full-stack configuration not fully aligned with a pure offline PWA).

## 5. DATA MODEL & STATE MANAGEMENT

**State Engine:** Powered by Zustand (`useStore.ts`). 
**Routing Model:** The system properly distinguishes between global state and **Output Group State**. The `groupStates` record maps an Output Group ID to an independent `PresentationState` (containing `activeItemId`, `activeSlideIndex`, `isBlack`, `isClear`, etc.). This means Route A can display a Song while Route B displays a Bible verse.

## 6. PRESENTATION CORE & THEME ENGINE

*   **PresentationCore**: IMPLEMENTED. Centralized slide generation. Songs, Bibles, PPTX, and Media all pass through `generateSlides()`. 
*   **ThemeEngine**: IMPLEMENTED. Resolves styles in strict cascading order (Global -> System Override -> Route -> Type -> Item -> Element).
*   **Verdict**: The presentation engine is robust and avoids duplicating rendering logic across content types.

## 7. OUTPUT ROUTING & DISPLAY SYSTEM

*   **Live Output Panels**: IMPLEMENTED. Panels reflect the actual resolved state of their assigned Group ID.
*   **Multi-Monitor Support**: BLOCKED BY BROWSER / OS LIMITATIONS. The app relies on `window.open` to launch Projector views. It cannot silently assign a specific HTML5 Canvas to a physical HDMI port. The operator must manually drag the popup window to the correct physical display and full-screen it.
*   **Synchronization**: IMPLEMENTED via `BroadcastChannel` and `localStorage` events. Fast and robust across tabs.

## 8. CONTENT ENGINES

*   **Songs**: IMPLEMENTED. Supports sections, lyrics parsing, backgrounds, and themes.
*   **Bible**: PARTIALLY IMPLEMENTED. Seed data exists, but full translation databases (NIV, ESV, etc.) are missing due to licensing/size constraints. 
*   **Media**: IMPLEMENTED. Supports video looping and image backgrounds.
*   **PPTX**: PARTIALLY IMPLEMENTED (Heuristic text extraction only). Uses `JSZip` to parse `slideX.xml`. **FAILS** to preserve formatting, animations, shapes, or original images. It is merely a text-importer.

## 9. WORKSPACE & UI/UX

*   **LayoutManager**: IMPLEMENTED. Uses `react-resizable-panels`. Drag-and-drop docking and splitters are functional.
*   **Live Controls**: IMPLEMENTED. Direct "Go Live" execution works flawlessly. Clear, Black, and Logo toggles apply independently to targeted output groups.

## 10. PERSISTENCE & BACKUP

*   **IndexedDB**: IMPLEMENTED. Stores all assets, themes, and schedules.
*   **Backup/Restore**: IMPLEMENTED. `exportDatabaseBackup()` accurately dumps JSON metadata and binary assets (if requested). `importDatabaseBackup()` correctly seeds the IndexedDB.

## 11. TESTING & BUILD

*   **Testing**: NOT IMPLEMENTED. The repository lacks unit tests, integration tests, or E2E tests (no Jest, Cypress, or Playwright configurations).
*   **Build**: IMPLEMENTED. Vite build succeeds.
*   **Type Safety**: IMPLEMENTED. TypeScript compiler runs without errors.

## 12. REQUIREMENT TRACEABILITY MATRIX

| Feature | Status | Risk / Evidence |
| :--- | :--- | :--- |
| Independent Output Routes | PASS | `groupStates` in `useStore.ts` isolates state. |
| Cross-Window Sync | PASS | `BroadcastChannel` active in `ProjectorView`. |
| Advanced PPTX Support | PARTIAL | `pptxParser.ts` only extracts raw text from XML. |
| Multi-monitor auto-assign | BLOCKED | Web browsers cannot force window placement silently. |
| Offline Bible Data | PARTIAL | UI exists, but lacks full Bible translation data. |
| Automated Testing | FAIL | `npm run test` fails (Missing script). |
| Offline Packaging (Desktop) | FAIL | No Electron/Tauri wrapper exists yet. |

## 13. CRITICAL BLOCKERS

**P0 — Release Blockers:**
1.  **Missing Native Shell (Electron/Tauri)**: The web browser environment is insufficient for professional multi-monitor worship software. A native shell is required to bypass popup blockers and manage physical displays (via APIs like Electron's `screen` module).

**P1 — High Priority:**
1.  **Test Coverage**: Zero automated tests exist for the critical `PresentationCore` and `ThemeEngine`.
2.  **PPTX Rendering Constraints**: The current text-only PPTX extraction will frustrate users migrating from EasyWorship/ProPresenter.

## 14. PRODUCTION READINESS SCORE

**Overall Score: 72/100**

*   **Architecture & Core (25/30)**: Exceptional state decoupling and theme cascading.
*   **Output Routing (12/15)**: Multi-route logic is sound, but blocked by browser windowing limits.
*   **Content Engines (20/30)**: Songs and Media are great. Bible lacks data; PPTX is primitive.
*   **Persistence (15/15)**: IndexedDB and JSON backups are robust.
*   **Testing & Security (0/10)**: Lack of testing is a major vulnerability.

## 15. RECOMMENDED NEXT PHASE

**DO NOT TOUCH WORKING ARCHITECTURE.** The Zustand state, Theme Engine, and Presentation Core are highly stable. 
**Phase 1:** Wrap the application in **Tauri or Electron** to gain native multi-display control and bypass browser sandbox limits.
**Phase 2:** Implement a full testing suite (Vitest + Playwright) before adding any new features.
**Phase 3:** Integrate a robust PPTX conversion library or backend service, replacing the heuristic XML text extractor.
