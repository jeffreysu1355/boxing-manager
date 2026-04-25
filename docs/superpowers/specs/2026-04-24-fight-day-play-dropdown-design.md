# Fight Day Play Dropdown

**Date:** 2026-04-24

## Overview

When the game date is advanced to a day that has a scheduled fight for a gym boxer, the Play dropdown changes to show fight-specific actions instead of the normal sim options.

## Behaviour

### Normal state (no fight today)

Play dropdown shows:
- Sim 1 Week
- Sim 1 Month
- Sim to Next Event

### Fight day state

Fight day is detected when `fightStop` is set (i.e. `TopNav` stopped simulation because today's date equals a CalendarEvent of type `fight` involving a gym boxer).

Play dropdown shows:
- **Play Fight** — navigates to `/fight/:fightId` (placeholder page for now)
- **Sim Fight** — resolves all gym fights on this date automatically, advances the game date past them, clears the banner

Normal sim options are hidden entirely.

If there are multiple gym boxers fighting on the same day, both actions apply to all of them in sequence (Play Fight cycles through each fighter one at a time on the fight page; Sim Fight resolves all of them).

## Data flow

`TopNav` already holds `fightStop: CalendarEvent | null`. `CalendarEvent.fightId` is the fight's ID in the `fights` store.

For multiple fights on the same day: filter all `CalendarEvent`s where `type === 'fight'`, `date === currentDate`, and `boxerIds` intersects `gymBoxerIds`. Collect all their `fightId`s.

- **Play Fight**: navigate to `/fight/:fightId` using the first fight in the list. The fight page will handle cycling through multiple fights later.
- **Sim Fight**: for each fight event on today's date, look up the `Fight` record, call the existing fight resolution logic (to be added), then advance the game date by 1 day and clear the banner.

For now, "Sim Fight" is a stub: it just advances the game date by 1 day past today and clears the banner (fight resolution logic is not yet implemented).

## New route

`/fight/:fightId` — placeholder page. Displays "Fight page coming soon" with the fight ID and a back link. Lives at `src/pages/Fight/FightPage.tsx`.

## Components changed

| File | Change |
|------|--------|
| `src/components/TopNav/TopNav.tsx` | Detect fight day; swap dropdown items; wire Play Fight nav and Sim Fight stub |
| `src/pages/Fight/FightPage.tsx` | New placeholder page |
| `src/router.tsx` (or wherever routes are defined) | Add `/fight/:fightId` route |

## Out of scope

- Actual fight resolution logic (sim fight just advances date for now)
- Round-by-round fight playback on the fight page
- Multi-fight cycling on the fight page
