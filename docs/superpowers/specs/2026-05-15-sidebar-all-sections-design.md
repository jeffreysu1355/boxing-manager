# Sidebar All-Sections Design

**Date:** 2026-05-15

## Goal

Expand the left sidebar so all top-level navigation sections (League, Gym, Players, Tools, Info) are always present, not just the section matching the current URL. The top nav bar stays unchanged — both nav surfaces remain usable.

## Behavior

### Section groups

Each top-level section is rendered as a collapsible group in the sidebar:

- **League** — Standings, Calendar, Results, Championship History, Schedule
- **Gym** — Roster, Finances, Coaches
- **Players** — Recruiting, Coaches, Compare
- **Tools** — God Mode
- **Info** — navigates directly to `/info` (no sub-pages, no expand/collapse)

### Expand/collapse

- Clicking a section header toggles it open or closed.
- On initial render, the section whose URL prefix matches the current pathname is auto-expanded; all others are collapsed.
- "Info" is a direct `NavLink` to `/info`, not a collapsible group.

### Active link highlight

Sub-links retain the existing active style: red left border, lighter background. No change to link styling.

### Top nav

No changes. The top nav tabs (Dashboard, League, Gym, Players, Tools, Info) remain as-is.

## Implementation

### Changes to `Sidebar.tsx`

Replace the current `getSections(pathname)` lookup (which filters to only the active section) with a static full list of all sections. Add a `collapsed` state map keyed by section label, initialized so the active section is expanded and all others are collapsed.

Section headers become `<button>` elements that toggle their collapsed state. Sub-links render only when the section is expanded.

Info renders as a standalone `NavLink` with the same section-label styling, not a collapsible group.

### No other files need to change

- `Sidebar.module.css` — add a style for the clickable section header button (inherits existing `sectionLabel` appearance, adds cursor/hover)
- `App.tsx`, `routes.tsx`, `TopNav.tsx` — untouched

## Out of scope

- Persisting collapsed state across page reloads
- Animating open/close transitions
- Changing the top nav
