# SimpleWorship - Phase 1 Forensic Audit & Gap Analysis

## 1. Forensic Audit Overview
- **Repository Structure:** React 19 + Vite + Tailwind CSS + Zustand + IndexedDB.
- **Persistence:** Local storage via `idb` and `zustand/middleware` for offline operation. No backend server.
- **Synchronization:** Multi-window sync achieved purely via `BroadcastChannel` (`sync.ts`).
- **Core Systems:** `PresentationCore` handles content parsing. `useStore` acts as the unified state manager for multiple Output Groups (`groupStates`).
- **Workspace UI:** Powered by `react-resizable-panels` with floating panel support and layout persistence.

## 2. Feature Classification & Gap Analysis

| ID | Feature | Status | Notes / Gap |
|---|---|---|---|
| A | Standalone Product | **IMPLEMENTED** | Runs entirely offline via IndexedDB. |
| C | Unified Presentation Core | **IMPLEMENTED** | `PresentationCore.ts` acts as the single pipeline. |
| D | Output Group System | **IMPLEMENTED** | `groupStates` in Zustand supports arbitrary groups. |
| E | Many Displays Per Group | **IMPLEMENTED** | Multiple projector windows can launch on the same `groupId`. |
| G | Display Discovery | **BLOCKED BY PLATFORM** | Browsers cannot enumerate physical displays silently without the experimental Screen Details API. |
| I | Hot-Plug | **BLOCKED BY PLATFORM** | Native OS event needed. |
| J | Output Synchronization | **IMPLEMENTED** | `BroadcastChannel` ensures all windows in a group sync instantly. |
| K | Live Preview | **IMPLEMENTED** | `MultiGroupPreviewBar.tsx` renders actual presentation state. |
| N | Songs | **IMPLEMENTED** | Full library, editor, and schedule integration exists. |
| O | Bible | **PARTIALLY IMPLEMENTED** | Seed data works, but a full offline Bible database/parser is missing. |
| R | Duplicate Asset Detection | **MISSING** | No hash-checking mechanism upon asset import. |
| S | Default Backgrounds | **IMPLEMENTED** | Global and item-specific overrides are functional. |
| W | Theme Engine | **PARTIALLY IMPLEMENTED** | Basic CSS/styling mapping exists in `ThemeEngine.ts`, but advanced property inheritance is incomplete. |
| AA | Video Engine | **IMPLEMENTED** | HTML5 video tag supports backgrounds underneath lyrics. |
| AB | Video Loop Controls | **MISSING** | UI lacks advanced loop counting (e.g., 2x, 3x). |
| AD | PowerPoint | **MOCKED** | `PresentationsTab.tsx` uses hardcoded arrays. Real PPTX parsing in-browser is not implemented. |
| AH | Stage Output | **IMPLEMENTED** | `StageMonitorContent.tsx` provides high-contrast current/next lyrics. |
| AM | Workspace Organization | **IMPLEMENTED** | Dockable, resizable, floating panels with persistence. |
| AU | Keyboard Shortcuts | **IMPLEMENTED** | Context-aware shortcuts (e.g., Ctrl+K, F6, F8). |
| AZ | Backup / Restore | **MISSING** | No JSON export/import mechanism for the IDB database. |
| BC | No Dead Buttons | **PARTIALLY IMPLEMENTED** | PPT and Bible tabs have some mock functionality. |
| BE | Automated Testing | **MISSING** | No Jest/Playwright tests exist. |

## 3. Architecture Audit
The architecture correctly separates:
- **Workspace State** (panels, docking) from **Presentation State** (what slide is active).
- **Presentation Model** (content) from **Theme Engine** (look and feel).
- **Asset Manager** uses centralized URLs, preventing duplication in the schedule state.
*Risk:* Heavy payloads over `BroadcastChannel` could cause sync drift if a video background base64 string is passed instead of a URL. (Currently mitigated by passing asset URLs).

## 4. Implementation Phase & Hardening (Completed in this session)
1. **Quick Search Integration**: Implemented a global song quick-search (Ctrl+K) that queries the local database and inserts directly into the schedule.
2. **Workspace Hardening**: Fixed missing `mediaLibrary` panel configuration in `WorkspaceContext.tsx` which was causing crashes upon docking.
3. **Shortcuts Module**: Hardened the Escape and shortcut event listeners in `ModeratorView` to avoid colliding with text inputs.

## 5. Recommended Next Steps (Phase 2)
1. **PPTX Parsing**: Integrate `pptxgenjs` or similar to actually extract slides.
2. **Screen Details API**: Request `window.getScreenDetails()` to natively discover and place windows on external monitors.
3. **Database Backup**: Implement a fast IDB to JSON export/import for the Backup requirement.
