# Watchlist Feature Design

**Date:** 2026-05-17

## Overview

A watchlist lets the user track any boxer they find interesting — from their own gym or from the global pool. It lives under the Players section alongside Recruiting and Compare.

## Data Model

Add an optional field to the existing `Gym` interface:

```ts
watchlistIds?: number[];
```

No DB version bump required. Absence of the field is treated as `[]` at runtime. Two new helpers added to `gymStore.ts`:

- `addToWatchlist(boxerId: number): Promise<void>` — reads gym, appends id if not present, saves
- `removeFromWatchlist(boxerId: number): Promise<void>` — reads gym, filters out id, saves

## Flag Icon

A small flag button rendered wherever a boxer is displayed. Three visual states:

| State | Color | Meaning |
|---|---|---|
| Not watchlisted | Grey (dim) | Clicking adds boxer to watchlist |
| Watchlisted, own gym boxer | Green (`var(--success)`) | Clicking removes from watchlist |
| Watchlisted, non-gym boxer | Red (`var(--danger)`) | Clicking removes from watchlist |

The flag is a clickable button (not a link). Clicking toggles watchlist state, writes to IndexedDB, and updates local component state immediately — no page reload.

## PlayerPage Integration

- On every `PlayerPage`, a flag button appears in the header near the boxer's name.
- On mount, the component loads the gym's `watchlistIds` into local state.
- Toggle writes to IndexedDB via `addToWatchlist`/`removeFromWatchlist` and updates local state, so the icon flips instantly.
- Green if watchlisted and boxer's `gymId` matches the player's gym; red if watchlisted but not in gym; grey if not watchlisted.

## Watchlist Page

**Route:** `/players/watchlist`
**Sidebar:** Added under Players section alongside Recruiting, Coaches, Compare.

### Columns

Same columns as the Roster page:
- Flag icon (green/red, clickable to remove)
- Name (linked to `/player/:id`)
- Weight Class
- Record (W-L)
- Reputation
- Status
- Next Fight
- Rank

### Behavior

- Loads gym on mount, reads `watchlistIds`, fetches all matching boxers.
- Each flag click calls `removeFromWatchlist` and removes the row immediately from local state.
- If watchlist is empty, shows: "No boxers on your watchlist yet."
- Boxers are sorted by weight class, then name (same default as Roster).

## Out of Scope

- Watchlist is not persisted per-boxer — it is a gym-level preference list.
- No notifications or alerts tied to watchlisted boxers.
- No sorting/filtering on the watchlist page beyond the default sort.
