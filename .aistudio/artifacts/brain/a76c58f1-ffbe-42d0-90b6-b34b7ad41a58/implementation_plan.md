# Manual Timer Size Adjustment & Full Windows / System Font Selector

Equip the Service Interval Countdown Timer with precision manual size controls (slider, `+/-` step buttons, direct numeric input, and quick presets) across both the **Main Live Display** and **Stage Foldback Display** (with independent or linked sizing), alongside a comprehensive **Windows & Host OS System Font Selector** featuring automatic local font detection, instant search, and live typographic preview.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during clarification and govern this implementation:

- **Confirmed Decision 1 — Manual Timer Size Control Suite**: Provide a complete interactive size control bar featuring a smooth range slider, fine-grain `-` / `+` step buttons, a direct numeric pixel/scale input, and one-click size presets (`Small`, `Medium`, `Large`, `XL`, `Max`, plus `Reset`).
- **Confirmed Decision 2 — Full System & Windows Font Selector**: Replace the limited 7-option dropdown with a full **Windows & System Font Picker** that automatically loads all installed Windows/OS fonts (via the Local Font Access API and canvas font probe catalog), complete with real-time search filtering, category grouping (`Installed Windows & OS Fonts`, `Microsoft Core & Office Fonts`, `Worship & Presentation Fonts`, `Custom Fonts`), and live rendered font previews.
- **Confirmed Decision 3 — Main Display & Stage Display Scope with Independent Option**: Apply manual timer sizing to both the **Main Live Display Overlay** and the **Stage Confidence Monitor**, including a toggle to adjust **Stage Display Timer Size** independently from the **Main Display Timer Size** (or keep them proportionally linked).

---

## 1. Overview & Core Concept

- **What It Does**: Gives worship media operators complete visual control over how the countdown timer renders on LED walls, projectors, and stage confidence monitors. Operators can dial in the exact timer digit size on the fly so it never clips or overwhelms custom aspect-ratio screens (such as 4:3 or 16:9 LED walls), and choose any font installed on their Windows PC or host operating system.
- **Target Audience / Persona**: Church media directors, projectionists, and stage managers running live services who need immediate, tactile adjustments for pre-service countdowns, sermon timers, and worship transitions.
- **Key Value**: Eliminates the fixed `440px` timer constraint and the restricted 7-font dropdown, allowing exact typographic matching with church branding and seamless scaling across any Main or Stage screen resolution.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Adjusting Main Display Timer Size**: In either the **Service Interval Timer Modal** (launched from the top toolbar) or **Options Dialog → Service Intervals**, the operator uses the `-` / `+` buttons, drags the range slider (`80px` – `700px`), types an exact pixel value, or clicks a preset button (`S 200px`, `M 320px`, `L 440px`, `XL 540px`, `MAX 640px`). The live Main Display canvas and connected projectors update immediately in real time.
  2. **Adjusting Stage Display Timer Size (Linked or Independent)**: By default, the Stage Display countdown scales cleanly, or the operator can toggle **"Independent Stage Timer Size"** to manually size the Stage Monitor countdown badge/digits (`12px` – `96px` with `S`, `M`, `L`, `XL` presets) using its own slider, `+/-` buttons, and numeric input.
  3. **Browsing & Selecting System & Windows Fonts**: Clicking the Timer Font selector opens a rich, searchable popover pre-populated with all detected Windows/OS fonts (`Segoe UI`, `Aptos`, `Calibri`, `Impact`, `Arial Black`, `Bahnschrift`, `Century Gothic`, `Consolas`, `Franklin Gothic Medium`, `Trebuchet MS`, `Verdana`, `Georgia`, `Times New Roman`, etc.) plus any locally installed machine fonts discovered via native OS scanning. Each row renders its own font face and a `05:00` numeric preview in `tabular-nums`.
  4. **One-Click OS Font Rescan & Custom Entry**: Operators can click **"Scan Windows / OS Fonts"** inside the selector to query newly installed system fonts or add a custom font family name on the spot.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft dark broadcast studio console (`#121317` / `#18191f` surfaces) adhering to single-elevation depth with crisp `1px solid` structural borders (`#2a2d36` / `#323642`).
  - *Color Palette & Mood*: Deep obsidian panels, warm amber accents (`#f59e0b`) for active timer controls and size presets, sky blue (`#38bdf8`) for OS font scanning actions, and emerald (`#10b981`) for active running telemetry.
  - *Typography & Hierarchy*: Clean UI labels (`Plus Jakarta Sans` / system sans) paired with strict tabular numerals (`font-variant-numeric: tabular-nums`) on all countdown readouts, pixel inputs, and font previews to guarantee zero layout jitter while counting down.
  - *Spatial & Control Math*: Single-line interactive buttons (`whitespace-nowrap shrink-0`), accessible touch targets, and balanced 2-column control grids with a live mini preview readout.

- **Interactive Feedback & Motion**:
  - Instant 0ms reactive preview on both the workspace Live Display Canvas and external Projector / Stage windows via BroadcastChannel state synchronization.
  - Smooth hover states (`150ms`) on `+/-` steppers and preset buttons, with active highlight rings on the currently matching preset.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Dual-Surface Controls (Quick Toolbar Modal + Full Options Dialog)**
  - *Chosen Approach*: Expose the full manual size adjustment suite and System/Windows Font Picker in both the quick **Service Interval Timer Modal** (top toolbar button) and the **System Options → Service Intervals** tab, backed by a shared Zustand store configuration.
  - *Why*: Operators frequently adjust timer size mid-service from the top toolbar modal as well as during pre-service setup in Options; keeping both surfaces identical prevents workflow friction.
  - *Alternatives Considered*: Placing size controls only inside the deep Options dialog was rejected because operators need rapid access while viewing the live canvas.

- **Decision 2: Hybrid Native OS Font Enumeration + Comprehensive Windows Font Catalog**
  - *Chosen Approach*: Combine the browser's `window.queryLocalFonts()` API and local IndexedDB font scanner with an instant-load catalog of 150+ standard Windows, Microsoft Office, and worship display fonts tested via canvas baseline measurement.
  - *Why*: Guarantees that all Windows system fonts are immediately selectable with zero permission delay, while also unlocking 100% of custom fonts installed on the user's Windows machine when native local font access is available.

- **Decision 3: Independent vs. Linked Stage Display Sizing**
  - *Chosen Approach*: Provide dedicated `fontSize` (Main Display, default `440px`) and `stageTimerSize` (Stage Display, default `16px` / `28px` projector scale) settings with an `independentStageSizing` toggle.
  - *Why*: Main LED walls often require massive full-screen digits (`300px–600px`), whereas Stage Confidence Monitors share screen real estate with current/next lyrics and chords, requiring independent control.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Windows & Host OS Font Engine                            │
│  • Native Local Font Access API (queryLocalFonts)                          │
│  • Windows 10/11 & Office Core Font Catalog + Canvas Availability Probe    │
│  • Searchable Font Selector with Live "05:00" Tabular Preview              │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                Service Interval Timer Configuration UI                     │
│  ┌───────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │   Top Toolbar Timer Modal         │ │  Options Dialog > Intervals    │  │
│  │ • Main Timer Size Slider & +/-    │ │ • Synced Size Slider & +/-     │  │
│  │ • Numeric px Input & Presets      │ │ • Independent Stage Size UI    │  │
│  │ • System & Windows Font Picker    │ │ • System & Windows Font Picker │  │
│  └─────────────────┬─────────────────┘ └────────────────┬───────────────┘  │
└────────────────────┼────────────────────────────────────┼──────────────────┘
                     │                                    │
                     └─────────────────┬──────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            Zustand Store & Cross-Window Broadcast Sync                     │
│  • serviceIntervals: { fontSize, stageTimerSize, independentStageSize,     │
│                        fontFamily, stageFontFamily, fontColor }            │
└────────────────────┬────────────────────────────────────┬──────────────────┘
                     │                                    │
                     ▼                                    ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────────┐
│   Main Display Countdown Overlay     │ │   Stage Display Countdown Timer   │
│  • Dynamic fontSize (px) & font      │ │  • Dynamic stageTimerSize (px)    │
│  • Tabular-nums zero-jitter layout   │ │  • Synced or custom stage font    │
└──────────────────────────────────────┘ └───────────────────────────────────┘
```

- **Data Model & State**:
  - Extend `SystemOptions['serviceIntervals']` with:
    - `fontSize?: number` — Manual pixel font size for the Main Display Countdown Overlay (default `440`, range `60` to `720`).
    - `independentStageSize?: boolean` — Whether Stage Display uses its own manual size override (default `false`).
    - `stageTimerSize?: number` — Manual pixel font size for the Stage Display Countdown Timer (default `16`, range `10` to `96`).
  - Persist all timer size and font fields automatically in IndexedDB and broadcast updates across open projector and stage windows.

- **Interactive Component & State Mapping**:
  - **Manual Size Control Widget**:
    - `-` / `+` buttons decrement/increment by `10px` on Main Display (`2px` on Stage Display) with bounds clamping.
    - Range slider provides continuous real-time dragging (`onChange` updates local state + store immediately so the operator sees live scaling on the canvas).
    - Direct numeric input allows typing exact pixel sizes with automatic clamping on blur/enter.
    - Preset buttons (`S`, `M`, `L`, `XL`, `MAX`, `Reset`) apply calibrated pixel sizes in a single click.
  - **System & Windows Font Selector**:
    - Auto-triggers a background non-blocking local font check on mount so installed Windows/OS fonts appear alongside curated Windows and Google fonts.
    - Search bar filters fonts instantaneously by name or category; clicking any font updates `serviceIntervals.fontFamily` and previews `05:00` in that exact font.
