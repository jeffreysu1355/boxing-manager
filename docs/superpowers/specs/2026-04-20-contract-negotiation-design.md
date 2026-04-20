# Contract Negotiation — Design Spec (Sub-project 2)

**Date:** 2026-04-20

## Overview

Sub-project 2 adds contract negotiation between the player and opponent AI. After selecting a boxer, event, and opponent on the Schedule page, the player is taken to a dedicated negotiation page (`/league/contracts/:id`) where they make offers on guaranteed payout and PPV split. The opponent AI responds probabilistically based on reputation gap and offer quality. The fight is only created after negotiation succeeds; unsigned contracts are deleted on cancel, rejection, or round exhaustion.

---

## Data Model Changes

### `FightContract` — two new fields

```typescript
export interface FightContract {
  id?: number;
  boxerId: number;
  opponentId: number;
  federationId: number;
  weightClass: WeightClass;
  guaranteedPayout: number;
  ppvSplitPercentage: number;       // player's share (0–100)
  ppvNetworkId: number | null;
  isTitleFight: boolean;
  status: ContractStatus;           // 'pending' | 'accepted' | 'countered' | 'rejected' | 'completed'
  counterOfferPayout: number | null;
  counterOfferPpvSplit: number | null;  // NEW: opponent's counter PPV split; null = not changed
  roundsUsed: number;                   // NEW: 0..3, incremented each time player submits
  scheduledDate: string | null;
  fightId: number | null;
}
```

### DB schema bump: v5 → v6

New migration block in `getDB` upgrade handler. Existing records are unaffected (idb returns `undefined` for missing fields; runtime code treats `undefined` as `0` / `null` where needed).

---

## Payout Increment Table

Valid guaranteed payout values (player offer and AI counter must snap to these):

| Range | Increment |
|-------|-----------|
| $1k – $10k | $1,000 |
| $10k – $100k | $10,000 |
| $100k – $1M | $100,000 |

PPV split: 0–100 in steps of 5.

---

## AI Logic (`evaluateOffer`)

Pure function exported from `ContractNegotiation.tsx`. No side effects — easy to unit test.

### Signature

```typescript
type AiDecision =
  | { outcome: 'accept' }
  | { outcome: 'counter'; payout: number | null; ppvSplit: number | null }
  | { outcome: 'reject' }

function evaluateOffer(params: {
  playerPayout: number;
  playerPpvSplit: number;
  gymBoxerRepIndex: number;    // 0–9
  opponentRepIndex: number;    // 0–9
  roundsUsed: number;          // 0..2 (this call is for round roundsUsed+1)
  random?: number;             // 0–1, injectable for tests (default Math.random())
}): AiDecision
```

### Fair value baseline

```
repGap = opponentRepIndex - gymBoxerRepIndex   // -9..+9
fairPayout = 10_000 × (0.5 + (repGap + 9) / 18 × 2.5)   // $5k at gap -9, $10k at 0, $32.5k at +9
fairPpvSplit = clamp(50 + repGap × 3, 10, 90)             // opponent's preferred player share
```

### Offer quality score

```
offerScore = (playerPayout / fairPayout) + (playerPpvSplit / fairPpvSplit)
// 2.0 = generous on both; 1.0 = exactly fair on both; 0 = insulting
```

### Decision probabilities

| offerScore | accept | counter | reject |
|------------|--------|---------|--------|
| ≥ 1.8 | 100% | 0% | 0% |
| ≥ 1.2 | 80% | 20% | 0% |
| ≥ 0.8 | 0% | 90% | 10% |
| < 0.8 | 0% | 30% | 70% |

**Round 3 modifier**: if `roundsUsed === 2` (final round), add +20% to reject probability (subtract from counter/accept proportionally).

### Counter values

When the AI counters, it adjusts fields that are below fair value:
- If `playerPayout < fairPayout`: new counter payout = `snapToIncrement(playerPayout + (fairPayout - playerPayout) / 2)`
- If `playerPpvSplit < fairPpvSplit`: new counter ppvSplit = `snapTo5(playerPpvSplit + (fairPpvSplit - playerPpvSplit) / 2)`
- Fields already at or above fair value: returned as `null` (no change requested)

`snapToIncrement(n)` rounds `n` up to the nearest valid payout increment.
`snapTo5(n)` rounds `n` up to the nearest multiple of 5, clamped 0–100.

---

## Negotiation Page (`/league/contracts/:id`)

### Route

`/league/contracts/:id` — added to league children in `routes.tsx`. Not shown in Sidebar.

### Data loading

On mount, load `FightContract` by id. Also load both boxers (gym boxer + opponent) for display. If contract not found or `status === 'accepted'`, redirect to `/league/calendar`.

### Layout

Single-column page:

**Header**
- Title: "Contract Negotiation"
- Subtitle: `<GymBoxerName> vs <OpponentName> · <Federation> · <Date> · <WeightClass>`

**Offer form** (always shown)
- Guaranteed Payout: `<select>` populated with all valid increments from $1k to $1M
- Your PPV Split %: `<input type="number">` step=5, min=0, max=100
- Default values on first load: payout=$1,000, ppvSplit=50

**Status area**
- `status === 'pending'`: "Make your opening offer."
- `status === 'countered'`: "Opponent counters: $X guaranteed / Y% PPV split. Round N of 3."
  - If `counterOfferPayout` is non-null, show it; otherwise show current contract payout.
  - If `counterOfferPpvSplit` is non-null, show it; otherwise show current contract ppvSplit.
- When the AI counters, pre-fill the offer form inputs with the opponent's counter values so the player sees a reasonable starting point for their next offer.

**Action buttons**
- Primary: `Submit Offer` (round 1), `Counter` (round 2), `Final Offer` (round 3)
- Secondary: `Cancel` (always shown)

### Submit handler

1. Increment `roundsUsed` on the contract
2. Call `evaluateOffer(...)` with current form values + boxer rep indices + new `roundsUsed`
3. Branch on `AiDecision.outcome`:

**accept**:
1. Create `Fight` record
2. `putFightContract({ ...contract, status: 'accepted', guaranteedPayout: playerPayout, ppvSplitPercentage: playerPpvSplit, fightId, roundsUsed })`
3. Create two `CalendarEvent` records (one per boxer)
4. Update `FederationEvent.fightIds`
5. Navigate to `/league/calendar`

**counter**:
1. `putFightContract({ ...contract, status: 'countered', roundsUsed, counterOfferPayout: decision.payout, counterOfferPpvSplit: decision.ppvSplit })`
2. Re-render page (state update, no navigation)

**reject** (or round 3 exhausted with counter that the player cannot respond to):
1. `deleteFightContract(contract.id)`
2. Navigate to `/league/schedule?boxerId=<boxerId>`

### Cancel handler

1. `deleteFightContract(contract.id)`
2. Navigate to `/league/schedule?boxerId=<boxerId>`

### Round exhaustion rule

After the player submits round 3 (`roundsUsed` will become 3), if the AI outcome is `counter`, treat it as `reject` (no 4th round possible). Delete contract and navigate back.

---

## Schedule.tsx Changes

`handleConfirm` is stripped to contract creation + navigation only:

```typescript
async function handleConfirm() {
  // 1. Create contract (pending, no fight yet)
  const contractId = await putFightContract({
    boxerId: gymBoxerId,
    opponentId,
    federationId: selectedEvent.federationId,
    weightClass: selectedGymBoxer.weightClass,
    guaranteedPayout: 0,
    ppvSplitPercentage: 50,
    ppvNetworkId: null,
    isTitleFight,
    status: 'pending',
    counterOfferPayout: null,
    counterOfferPpvSplit: null,
    roundsUsed: 0,
    scheduledDate: selectedEvent.date,
    fightId: null,
  });
  // 2. Navigate to negotiation
  navigate(`/league/contracts/${contractId}`);
}
```

All fight/calendar/federation-event writes are removed from `Schedule.tsx`.

---

## New Files

- `src/pages/League/ContractNegotiation.tsx` — page component + `evaluateOffer` + `snapToIncrement` + `snapTo5`
- `src/pages/League/ContractNegotiation.module.css` — scoped styles
- `src/pages/League/ContractNegotiation.test.ts` — unit tests for `evaluateOffer`, `snapToIncrement`, `snapTo5`

## Schedule.tsx: Boxer availability check

The current `bookedBoxerIds` detection uses `calendarEvents` (only created after acceptance). With Sub-project 2, a boxer could re-appear as "available" while a `pending` contract exists. Fix: also load all `pending`/`countered` contracts and add their `boxerId` to `bookedBoxerIds`.

```typescript
// In Schedule load():
const pendingContracts = await getFightContractsByStatus('pending');
const counteredContracts = await getFightContractsByStatus('countered');
for (const c of [...pendingContracts, ...counteredContracts]) {
  bookedBoxerIds.add(c.boxerId);
}
```

---

## Modified Files

- `src/db/db.ts` — add `counterOfferPpvSplit: number | null` and `roundsUsed: number` to `FightContract`; schema v5→v6 migration block
- `src/pages/League/Schedule.tsx` — simplify `handleConfirm` (contract-create + navigate only)
- `src/routes.tsx` — add `/league/contracts/:id` route pointing to `ContractNegotiation`

---

## CSS Notes

Follows existing dark-theme conventions. Key classes needed:

- `.page`, `.header`, `.subtitle` — standard page scaffold
- `.form` — vertical stack for offer inputs
- `.field` — label + input pair
- `.statusBox` — bordered box showing AI response / round info
- `.actions` — flex row for buttons
- `.primaryBtn`, `.cancelBtn` — primary (accent) and secondary (ghost) button styles
