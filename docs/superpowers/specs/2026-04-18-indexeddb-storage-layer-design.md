# IndexedDB Storage Layer Design

**Date:** 2026-04-18
**Status:** Approved
**Scope:** DB setup, CRUD store modules for Boxer, Coach, and Gym entities

---

## Context

Boxing Manager stores all game state client-side. This design covers the IndexedDB storage layer that will underpin the Boxer, Coach, and Gym data models. Other entities (Federation, Title, FightRecord, Injury, PPVNetwork, Calendar) will be added in future tasks once their models are designed.

---

## Architecture

**Pattern:** Direct IndexedDB via the `idb` library — no shared worker. The game is a turn-based simulator; the main thread is idle during most operations, so DB access on the main thread does not cause meaningful jank. A shared worker can be added later without changing the store interfaces.

**Library:** [`idb`](https://github.com/jakearchibald/idb) — a small (~1KB) Promise/async wrapper around IndexedDB. No other DB dependencies.

**ID strategy:** Auto-increment integers, `keyPath: 'id'`. IDs are assigned by IndexedDB on first insert. This is appropriate because new entity creation (boxer signing, etc.) is infrequent and a DB round-trip for ID assignment is acceptable.

---

## File Structure

```
src/db/
├── db.ts           # Opens DB, defines schema and typed DB interface, exports db instance
├── boxerStore.ts   # Boxer interface + CRUD functions
├── coachStore.ts   # Coach interface + CRUD functions
└── gymStore.ts     # Gym interface + getGym / saveGym
```

---

## DB Setup (`db.ts`)

Opens the database using `idb`'s `openDB`. Defines a `BoxingManagerDB` type (the `idb` generic parameter) mapping each store name to its value type. This ensures all store access throughout the app is fully typed.

**Database name:** `boxing-manager`
**Version:** `1`

### Object Stores

| Store     | keyPath | autoIncrement | Indexes                          |
|-----------|---------|---------------|----------------------------------|
| `boxers`  | `id`    | yes           | `weightClass` (non-unique)       |
| `coaches` | `id`    | yes           | `style` (non-unique)             |
| `gym`     | `id`    | yes           | none                             |

**Why no federation index on boxers:** Boxers don't belong to a single federation — they can fight in any federation's events and hold titles across multiple federations over their career. Federation affiliation is derived from the `titles` and `fightRecords` stores (added in a future task). An index here would be misleading and stale.

---

## Store Modules

Each module co-locates its TypeScript interface with its CRUD functions. When full model work begins, the interfaces move to `src/models/` and the store files import from there — no CRUD code changes required.

### `boxerStore.ts`

**Interface: `Boxer`**

```ts
interface Boxer {
  id?: number;                          // assigned by DB on insert
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;                 // null = AI/unowned boxer
  stats: BoxerStats;
  naturalTalents: NaturalTalent[];
  injuries: Injury[];
  titles: TitleRecord[];
  record: FightRecord[];
}
```

Supporting types (defined in the same file for now):
- `WeightClass`: `'flyweight' | 'lightweight' | 'welterweight' | 'middleweight' | 'heavyweight'`
- `FightingStyle`: `'out-boxer' | 'swarmer' | 'slugger' | 'counterpuncher'`
- `ReputationLevel`: union of the 10 reputation strings
- `BoxerStats`: object with all 17 stats as `number` fields, organized into offense / defense / mental / physical categories
- `NaturalTalent`, `Injury`, `TitleRecord`, `FightRecord`: minimal placeholder interfaces (just `id` and a description string) — to be fully defined in the models task

**CRUD functions:**
- `getBoxer(id: number): Promise<Boxer | undefined>`
- `getAllBoxers(): Promise<Boxer[]>`
- `getBoxersByWeightClass(weightClass: WeightClass): Promise<Boxer[]>` — uses the `weightClass` index
- `putBoxer(boxer: Boxer): Promise<number>` — returns the assigned/existing id; handles both insert and update
- `deleteBoxer(id: number): Promise<void>`

---

### `coachStore.ts`

**Interface: `Coach`**

```ts
interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;       // null = unassigned
}
```

Supporting types:
- `CoachSkillLevel`: `'local' | 'contender' | 'championship-caliber' | 'all-time-great'`

**CRUD functions:**
- `getCoach(id: number): Promise<Coach | undefined>`
- `getAllCoaches(): Promise<Coach[]>`
- `getCoachesByStyle(style: FightingStyle): Promise<Coach[]>` — uses the `style` index
- `putCoach(coach: Coach): Promise<number>`
- `deleteCoach(id: number): Promise<void>`

---

### `gymStore.ts`

Only one gym record ever exists (id: 1, created when a new game starts). No generic CRUD — just two named helpers that make the single-record contract explicit.

**Interface: `Gym`**

```ts
interface Gym {
  id?: number;
  name: string;
  level: number;        // 1–10
  balance: number;      // dollars
  rosterIds: number[];  // boxer ids owned by this gym (denormalized for fast roster lookup — avoids scanning all boxers)
  coachIds: number[];   // coach ids employed by this gym
}
```

**Functions:**
- `getGym(): Promise<Gym | undefined>` — fetches id: 1
- `saveGym(gym: Gym): Promise<void>` — puts the record (creates on first call, updates thereafter)

---

## Constraints and Rules

- Stats range 1–20 normally, 1–25 if the boxer has a natural talent for that stat. Enforcement lives in the model/game logic layer, not in the store.
- `putBoxer` / `putCoach` are upsert operations (idb's `put` semantics): if `id` is present, it updates; if absent, it inserts and the returned number is the new id.
- No cascading deletes are implemented at the DB layer — deleting a boxer does not automatically unassign their coach. The game logic layer is responsible for cleanup.

---

## Future Stores (not in scope here)

When their models are designed, the following stores will be added as new DB versions:

- `titles` — with indexes on `federationId` and `weightClass`
- `fightRecords` — with index on `boxerId`
- `injuries` — currently embedded on `Boxer`, may be promoted to own store if querying across boxers is needed
- `ppvNetworks`
- `calendarEvents` — with index on `date`
