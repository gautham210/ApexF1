# Race Center and Navigation Responsive Remediation (M-05 & M-06)
**Affected Findings:** F-03 (M-05), F-07 (M-06), F-06 (M-08), F-09 (M-10), F-10 (M-11), F-11 (M-12), F-12 (M-13), F-15 (M-16)  
**Date:** 2026-10-21  
**Status:** **FIXED & VERIFIED**  

---

## 1. M-05 / F-03: Race Center Responsive Layout & Timing Tower Overflow

### Problem Analysis & Reproduction
- **Root Cause:** In `frontend/src/routes/race-center.tsx`, the leaderboard header and data rows were hardcoded with `min-w-[550px]`, and the scroll wrapper was marked with `scrollbar-none`. Its parent grid item (`xl:col-span-1`) possessed the default CSS Grid `min-width: auto` without `min-w-0`.
- **Failure Mode on Mobile (320px–390px):** The unconstrained grid child expanded to the table's minimum content width (552px), forcing the entire document body to 576px scroll width. Users experienced horizontal viewport wobble and clipped controls.
- **Failure Mode on Desktop (1024px–1440px):** The left column (Timing Tower) was allocated ~380px–420px of width in a 3-column grid (`xl:grid-cols-3`). Because the table was `min-w-[550px]` and `scrollbar-none` concealed the scrollbar, the rightmost columns (Gap, Last Lap, Pits) were permanently hidden offscreen with zero scroll affordance.

### Remediation Applied
1. **Grid Container Constraint:** Added `min-w-0` to `xl:col-span-1` and `xl:col-span-2` grid children so they respect parent boundaries and allow internal horizontal scroll containment.
2. **Responsive Column Strategy:** Replaced the rigid `COLS = "32px 1fr 100px 38px 70px 70px 32px"` with a responsive template:
   `COLS = "28px minmax(64px, 1fr) minmax(60px, 90px) 30px 58px 62px 28px"`
   Total base minimum width reduced from 550px to 330px, fitting comfortably inside 340px–390px viewports without horizontal page overflow.
3. **Accessible Scroll Containment:** Removed `scrollbar-none`. Added `scrollbar-thin`, `focus-visible:outline-none`, `tabIndex={0}`, `role="region"`, and `aria-label="Timing Tower Leaderboard"`.
4. **Column Prioritization & Truncation:** Enabled text truncation and flexible abbreviation/full name rendering on Driver and Constructor columns.
5. **Archive Error Boundary (F-11):** Updated `ArchiveLeaderboard` to capture errors rather than silently swallowing them in an empty `.catch()`, rendering an explicit error alert card.
6. **Telemetry Top Speed Mismatch (F-09):** Displayed computed `telemetryAnalysis.d1MaxSpeed` and `d2MaxSpeed` for "Top Speed", with active scrubber speed labeled accurately as "Cursor: ... km/h".
7. **Archive Timestamp Accuracy (F-10):** Restricted "Updated [time]" status to active live sessions (`showLive && live.last_update`).

---

## 2. M-06 / F-07: Mobile Bottom Navigation Clipping & Safe Area

### Problem Analysis & Reproduction
- **Root Cause:** `frontend/src/components/AppSidebar.tsx` rendered all 9 primary and secondary navigation links in a single fixed bottom pill:
  `9 items × 44px + 8 gaps × 4px = 396px + 36px padding = 432px width`.
- **Failure Mode on Mobile:** On a standard 390px mobile viewport (iPhone 12/13/14/15/16) or 375px/320px devices, navigation items extended offscreen. The bar lacked `env(safe-area-inset-bottom)`, causing controls to collide with system home indicators.

### Remediation Applied
1. **Hierarchical 4-Destination + More Architecture:**
   - **Dock Items:** Today (`/`), Sessions (`/sessions`), Race Center (`/race-center`), Standings (`/standings`), plus a `More` trigger button.
   - **Dock Width:** `5 items × 44px + 4 gaps × 6px + 12px padding = 256px`. Fits with generous margin on 320px, 375px, 390px, and 430px viewports without horizontal clipping.
2. **Accessible Overflow Sheet:**
   - Tapping `More` opens a modal sheet displaying remaining destinations: Replays (`/replay`), News (`/news`), Calendar (`/calendar`), Alerts (`/notifications`), Profile (`/profile`).
   - Accessible keyboard handling (Escape key closes, focus traps), `aria-expanded`, `aria-haspopup="dialog"`.
   - Active indicator dot displayed on the `More` button when the user is on any secondary route.
   - Sheet automatically closes upon navigation.
3. **Safe-Area Inset Support:** Styled container with `bottom-[max(1rem,env(safe-area-inset-bottom))]` and touch targets strictly `>= 44px`.

---

## 3. Related Remediation Highlights

### M-08 / F-06: Circuit Geometry Spa Fallback
- `frontend/src/components/CircuitOutline.tsx` no longer defaults unknown circuits to Spa. If a circuit key is not verified, it returns `null`.
- `frontend/src/routes/sessions.tsx` displays an honest "Circuit outline unavailable" badge instead of rendering a false Belgian circuit outline for Austin, Las Vegas, Qatar, etc.

### M-13 / F-12: Replay Action Differentiation
- `frontend/src/routes/replay.tsx` previously rendered two identical CTAs both directing to `mode=replay`. One CTA now opens "Race Replay" (`mode=replay`) while the other opens "Archive Results" (`mode=archive`).

### M-16 / F-15: Single `<main>` Landmark
- Replaced nested `<main>` tags in `drivers.$driverId.tsx`, `news.tsx`, and `teams.$constructorId.tsx` with `<div className="...">`. The single canonical `<main>` landmark is now provided by `__root.tsx`.
