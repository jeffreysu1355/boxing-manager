# PPV Network Signup — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## Overview

After a fight contract is accepted and a fight is scheduled, the player can optionally sign with a PPV network to earn additional revenue on top of their guaranteed payout. This is a post-schedule, pre-fight step. Network selection is per-fight only — no ongoing contracts.

---

## Data Model Changes

### `PpvNetwork` (breaking change — DB migration required)

Remove: `contractedBoxerId`, `contractStart`, `contractEnd`
Add: `federationId`, `minBoxerRank`

```ts
interface PpvNetwork {
  id?: number;
  name: string;
  federationId: number;         // which federation this network belongs to
  minBoxerRank: number;         // min reputation index (0–9); at least ONE boxer must meet this
  baseViewership: number;       // base audience size (before bonuses)
  titleFightMultiplier: number; // applied to total viewers for title fights
}
```

`FightContract.ppvNetworkId: number | null` — no change. Already exists.

### Revenue Calculation

PPV payout to the player:

```
actualViewers × (contract.ppvSplitPercentage / 100) × PPV_REVENUE_PER_VIEWER
```

`playerRevenueShare` is NOT stored on the network — it comes entirely from the negotiated `ppvSplitPercentage` on the contract.

### Eligibility

A network is eligible for a fight if:

```
max(gymBoxerReputationIndex, opponentReputationIndex) >= network.minBoxerRank
```

---

## World Generation

Each of the 7 federations gets 5–6 networks seeded at game start. Networks tier by rank requirement. The IBF gets an extra ultra-premium network.

| Tier | minBoxerRank | baseViewership | titleFightMultiplier | Count per fed |
|---|---|---|---|---|
| Local | 0 | 50k–200k | 1.2–1.3 | 2 |
| Regional | 3 (Respectable Opponent) | 300k–800k | 1.3–1.5 | 2 |
| National | 5 (Championship Caliber) | 1M–3M | 1.5–1.6 | 1 |
| Premium | 7 (World Class Fighter) | 5M–15M | 1.6–1.8 | 1 |
| Ultra-Premium (IBF only) | 8 (International Superstar) | 20M–50M | 1.8–2.0 | 1 |

Network names are federation-flavored. Examples:
- NABF: "NABF Sports", "NABF Fight Night", "America Boxing Live", "North America Championship Boxing", "Prime Sports PPV"
- EBF: "EBF Sports", "European Fight Night", etc.

---

## Viewership Calculation

```
actualViewers = base × homeFederationBonus × rankBonus × titleBonus
```

- **base**: `network.baseViewership × 0.6` (60% of base watch)
- **homeFederationBonus**: `1.2` if fight's federation matches network's federation, else `1.0`
- **rankBonus**: sum excess rank levels above `minBoxerRank` for both boxers independently, multiply by `0.05`, cap total bonus at `0.5`. Formula: `Math.min(1.5, 1 + (excessA + excessB) * 0.05)` where `excessX = max(0, boxerXRankIndex - minBoxerRank)`
- **titleBonus**: multiply by `network.titleFightMultiplier` if `fight.isTitleFight`, else `1.0`

The UI shows this estimated viewer count before the player confirms.

---

## DB Migration

- Version bump: 8 → 9
- On upgrade: clear and re-seed `ppvNetworks` store (existing records are incompatible with new schema)
- Safe to wipe: the PPV signup UI didn't exist before, so no contracts have a `ppvNetworkId` set

---

## Navigation & UI Flow

### Entry Point: Calendar

- Each scheduled future fight row gains a "Sign PPV Deal" button — shown only when `contract.ppvNetworkId === null` and the fight hasn't occurred yet
- If a network is already signed, show "PPV: [Network Name]" as a badge instead

### PPV Signup Page: `/league/ppv/:fightId`

**Route:** New route added alongside existing league routes.

**Layout:**
1. Fight summary header: `[Boxer] vs [Opponent] · [Federation] · [Date]`
2. Network list — all networks for the fight's federation, sorted lowest to highest tier
3. "Skip PPV" option (saves `ppvNetworkId: null`, redirects to Calendar)
4. "Confirm" button — saves selected `ppvNetworkId` to the contract, redirects to Calendar

**Network card (per network):**
- Name
- Rank requirement (e.g. "Open" for rank 0, or "Requires Championship Caliber+")
- Estimated viewers (computed with viewership formula)
- Title fight note (e.g. "×1.6 for title fights") if fight is a title fight
- Payout preview: `estimatedViewers × (ppvSplitPercentage / 100) × $0.50` (PPV revenue = $0.50 per viewer)
- Ineligible: grayed out, shows reason ("Requires [Rank] or higher — your best boxer is [Rank]")

**Interaction:**
- Clicking an eligible network highlights/selects it
- Ineligible networks are not clickable
- "Skip PPV" and "Confirm" are always available (Confirm requires a selection or uses Skip behavior)

---

## Files Touched

| File | Change |
|---|---|
| `src/db/db.ts` | Update `PpvNetwork` interface; bump DB version to 9; add migration step |
| `src/db/worldGen.ts` | Add `generatePpvNetworks()` called from `generateWorld()` |
| `src/db/ppvNetworkStore.ts` | No interface changes; add `getPpvNetworksByFederation()` helper |
| `src/pages/League/PpvSignup.tsx` | New page component |
| `src/pages/League/PpvSignup.module.css` | New styles |
| `src/pages/League/Calendar.tsx` | Add "Sign PPV Deal" button / PPV badge per row |
| `src/routes.tsx` | Add `/league/ppv/:fightId` route |
