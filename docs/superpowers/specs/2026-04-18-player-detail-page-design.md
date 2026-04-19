# Player Detail Page — Design Spec

**Date:** 2026-04-18

## Overview

A dedicated page for viewing a boxer's full profile: header info, grouped stats, and fight record. Accessible from any place a boxer name appears in the UI by clicking their name.

## Routing

- Route: `/player/:id` — top-level child of `App` (sibling to `/league`, `/gym`, `/players`, `/tools`)
- No sidebar entry; sidebar renders empty (consistent with dashboard behavior)
- Back navigation via browser's back button

## Page Sections

### 1. Header
- Name (large, primary)
- Age, weight class, style, reputation on one line
- W-L record (computed from `boxer.record`)
- Title badges: if `boxer.titles` has entries with `dateLost === null`, show each as a badge
- Natural talent tags: each entry in `boxer.naturalTalents` shown as a small tag (e.g. "Super Speed")

### 2. Stats — Grouped Panels
Four panels laid out in a 2×2 grid:

| Panel | Stats |
|-------|-------|
| Offense | Jab, Cross, Lead Hook, Rear Hook, Uppercut |
| Defense | Head Movement, Body Movement, Guard, Positioning |
| Mental | Timing, Adaptability, Discipline |
| Physical | Speed, Power, Endurance, Recovery, Toughness |

Each stat displayed as: `Stat Name    14` (label left, value right, monospace). Values on 1–20 scale (up to 25 with natural talent).

### 3. Fight Record
Table, sorted newest-first. Columns:
- Result (Win/Loss/Draw, color-coded: green/red/gray)
- Opponent name
- Method (KO / TKO / Decision / Split Decision)
- Round
- Time
- Federation
- Date

## Linking

Wherever a boxer name is rendered in the frontend, it becomes a `<Link to={/player/${boxer.id}}>`. Current locations requiring updates:
- `src/pages/League/Standings.tsx` — boxer names in the standings table

Future pages (Roster, Recruiting, Compare) should follow the same pattern when built.

## Data Fetching

- `getBoxer(id)` from `boxerStore` — single fetch on mount using `useParams`
- If boxer not found (bad ID), show a "Boxer not found" message
- Loading state while fetch is in progress

## Files to Create/Modify

- **Create** `src/pages/Player/PlayerPage.tsx`
- **Create** `src/pages/Player/PlayerPage.module.css`
- **Modify** `src/routes.tsx` — add `/player/:id` route
- **Modify** `src/pages/League/Standings.tsx` — wrap names in `<Link>`
