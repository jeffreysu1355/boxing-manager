# Recruiting Page — Design Spec

**Date:** 2026-04-18

## Overview

The Recruiting page has two sections: youth Prospects (under-18) and veteran Free Agents. Both pools are generated at world gen time and stored in IndexedDB. Recruiting a boxer costs a signing bonus deducted from the gym balance.

## Data Model

No new DB fields needed. Recruitable boxers are identified by:
- `gymId: null` — not yet signed to any gym
- `federationId: null` — not part of any federation
- `age < 18` → Prospect; `age >= 18` → Free Agent

Both are created during `generateWorld()` alongside federation fighters.

## World Gen Changes

Add to `generateWorld()`:

**Prospects (~15 total):**
- Age: 14–17
- Reputation: Unknown
- Stats: Unknown range (2–8), with style focus skewing slightly higher
- Record: 0–5 amateur bouts (FightRecord with federation = "Amateur")
- Signing bonus: stored as a field... wait — signing bonus is computed from reputation at display time, not stored.

Actually: signing bonus is derived at display time from reputation level. No extra field needed.

**Free Agents (~25 total):**
- Age: 22–35
- Reputation distribution (weighted):
  - ~60% Unknown
  - ~30% Local Star
  - ~8% Rising Star
  - ~1.5% Respectable Opponent
  - ~0.5% Contender
- Pro fight records appropriate to reputation
- Style: random

## Gym Level → Visible Reputation Filter (Free Agents)

| Gym Level | Max Visible Reputation |
|-----------|------------------------|
| 1–2 | Unknown |
| 3–4 | Local Star |
| 5–7 | Rising Star |
| 8–10 | Respectable Opponent, Contender |

Rare tiers (Rising Star+) are already in the pool — they become visible as gym level increases. The rarity is baked into the pool distribution at world gen (<10% of pool is Rising Star or above).

## Signing Bonus by Reputation

| Reputation | Signing Bonus |
|------------|---------------|
| Unknown | $1,000 |
| Local Star | $3,000 |
| Rising Star | $8,000 |
| Respectable Opponent | $20,000 |
| Contender | $50,000 |

Prospects (always Unknown reputation) cost $500–$1,500 randomised at world gen and stored on the boxer... actually since Unknown = $1,000 flat, prospects just use that. Keep it simple.

## Recruit Action

1. Check `gym.balance >= signingBonus`. If not, button disabled with "Insufficient funds" title.
2. On click: deduct bonus from `gym.balance`, set `boxer.gymId = gym.id`, save both.
3. Boxer immediately disappears from the recruiting pool (gymId no longer null).

## UI Structure

### Page Layout
```
[PageHeader: Recruiting]

[Section: Prospects]
  Table: Name | Age | Style | Record | Signing Bonus | Recruit

[Section: Free Agents]
  Table: Name | Age | Style | Reputation | Record | Signing Bonus | Recruit
```

- Boxer names link to `/player/:id`
- Recruit button disabled + tooltip if insufficient funds
- If pool is empty for a section: "No [prospects/free agents] currently available."
- Gym balance shown in a small callout at top of page so player knows their budget

## Files to Create/Modify

- **Modify** `src/db/worldGen.ts` — generate prospects and free agents
- **Modify** `src/db/gymStore.ts` — may need nothing new (getGym/saveGym already exist)
- **Modify** `src/pages/Players/Recruiting.tsx` — full UI
- **Create** `src/pages/Players/Recruiting.module.css` — styles

## Session Progress

- [x] Design approved
- [ ] Update worldGen to generate prospects and free agents
- [ ] Build Recruiting.tsx UI (two sections, recruit action)
- [ ] Create Recruiting.module.css
