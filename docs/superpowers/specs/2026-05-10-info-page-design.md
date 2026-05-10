# Info Page Design

**Date:** 2026-05-10

## Overview

A new top-level "Info" page at `/info` that serves as a static reference guide for game mechanics. It covers fighting styles (stat focus areas), the style counter cycle, and the reputation ladder. All data is sourced from existing constants — no new data to maintain.

## Route & Navigation

- New route: `{ path: 'info', element: <InfoPage /> }` added as a child of the root `App` route in `routes.tsx`
- New tab `{ to: '/info', label: 'Info' }` added to the `tabs` array in `TopNav.tsx`
- No sidebar entry needed — `sidebarConfig` in `Sidebar.tsx` has no `/info` key, so the sidebar renders empty automatically
- No layout wrapper or sub-routes; `InfoPage` is a flat single-page component at `src/pages/Info/InfoPage.tsx`

## Page Sections

### 1. Fighting Styles

Displays all 4 styles with their focused stats. Each style card/row lists:
- Style name (Out-Boxer, Swarmer, Slugger, Counterpuncher)
- Focused stats grouped by category (Offense / Defense / Mental / Physical), using the `STYLE_FOCUS` map from `fightSim.ts` and `STAT_LABELS` / `STAT_GROUPS` from `PlayerPage.tsx` (or duplicated locally)

Focused stats are weighted 2× in the fight simulation stat score; all other stats are weighted 1×.

### 2. Style Counters

Shows the rock-paper-scissors counter cycle:

```
Out-Boxer → beaten by Swarmer → beaten by Slugger → beaten by Counterpuncher → beaten by Out-Boxer
```

Displayed as a simple linear chain or cycle diagram using text/CSS. Notes that style matchup contributes 20% of the fight outcome formula (the `styleAdj` term, ±0.10).

Data source: `STYLE_COUNTERS` in `fightSim.ts`.

### 3. Reputation Ladder

Ordered list from lowest to highest of all 10 reputation levels, with promotion threshold for each tier:

| Rank | Reputation | Points to Promote |
|------|-----------|-------------------|
| 1 (lowest) | Unknown | 20 |
| 2 | Local Star | 30 |
| 3 | Rising Star | 40 |
| 4 | Respectable Opponent | 55 |
| 5 | Contender | 70 |
| 6 | Championship Caliber | 85 |
| 7 | Nationally Ranked | 100 |
| 8 | World Class Fighter | 120 |
| 9 | International Superstar | 150 |
| 10 (highest) | All-Time Great | — (max tier) |

Data source: `REPUTATION_ORDER` and `RANK_CONFIG` from `rankSystem.ts`.

## Implementation Notes

- `InfoPage.tsx` is a pure static component — no DB reads, no state, no effects
- Style/stat data is imported directly from `fightSim.ts` (exported constants) and `rankSystem.ts`
- `STAT_LABELS` and `STAT_GROUPS` can be duplicated locally in `InfoPage.tsx` or extracted to a shared constants file if reuse warrants it
- CSS Module `InfoPage.module.css` follows the same dark-theme conventions as other pages
- No new shared files required unless the team decides to centralize `STAT_LABELS`

## Files Affected

| File | Change |
|------|--------|
| `src/pages/Info/InfoPage.tsx` | New — page component |
| `src/pages/Info/InfoPage.module.css` | New — scoped styles |
| `src/routes.tsx` | Add `/info` route |
| `src/components/TopNav/TopNav.tsx` | Add "Info" tab |
| `src/lib/fightSim.ts` | Export `STYLE_FOCUS` and `STYLE_COUNTERS` (currently not exported) |
