# Finances Page — Design Spec

**Date:** 2026-04-19

## Overview

The Finances page lives under the Gym tab. It shows the gym's current level and balance, and lets the player upgrade the gym by spending money. Upgrades use an inline confirmation flow — no modal.

## Gym Initialization

`generateWorld()` currently does not create the gym record. We will add gym creation there:

- `name`: "My Gym"
- `level`: 1
- `balance`: $500,000,000 (testing default)
- `rosterIds`: []
- `coachIds`: []

## Page Layout

Single section containing:

1. **Gym name + level** — e.g. `My Gym — Level 3 / 10`
2. **Balance** — displayed prominently, e.g. `$500,000,000`
3. **Upgrade block:**
   - Level < 10: "Upgrade to Level 4 — $75,000" with an Upgrade button
   - Level = 10: "Max Level" text, no button

## Upgrade Button States

- **Affordable** (balance ≥ cost): button enabled
- **Cannot afford** (balance < cost): button disabled, greyed out, `title` tooltip shows e.g. "Requires $75,000 — you are $25,000 short"
- **Confirming**: see below

## Inline Confirmation

When the Upgrade button is clicked, the upgrade block expands inline (no modal) to show:

> "Upgrade to Level 4 for $75,000? This cannot be undone."
> [Confirm] [Cancel]

On **Confirm**: deduct cost from `gym.balance`, increment `gym.level`, save via `saveGym()`, re-render.
On **Cancel**: collapse back to normal upgrade block, no changes.

## Upgrade Cost Table

| From Level | To Level | Cost |
|------------|----------|------|
| 1 | 2 | $10,000 |
| 2 | 3 | $25,000 |
| 3 | 4 | $75,000 |
| 4 | 5 | $200,000 |
| 5 | 6 | $500,000 |
| 6 | 7 | $1,500,000 |
| 7 | 8 | $5,000,000 |
| 8 | 9 | $15,000,000 |
| 9 | 10 | $78,000,000 |

Total cost to max: ~$100,000,000

## Files to Create/Modify

- **Modify** `src/db/worldGen.ts` — add gym creation in `generateWorld()`
- **Modify** `src/pages/Gym/Finances.tsx` — full UI
- **Create** `src/pages/Gym/Finances.module.css` — styles
