# AGENTS.md — Boxing Manager Codebase Reference

Quick-start reference for AI agents. Read this before scanning files.

---

## Project Layout

```
src/
├── main.tsx              # Entry point — calls initGameIfNeeded() then mounts React
├── App.tsx               # Root layout: TopNav + Sidebar + <Outlet>
├── routes.tsx            # React Router v7 route definitions
├── index.css             # Global dark theme CSS (defines --bg-*, --text-*, --border, --success, --warning, --danger, etc.)
├── data/
│   └── names.json        # Country-keyed {first, last} weighted name maps for procedural generation
├── components/
│   ├── PageHeader/       # Reusable page header component
│   ├── Sidebar/          # Left nav sidebar (collapsible sections)
│   └── TopNav/           # Top navigation bar + advance-day logic
├── db/
│   ├── db.ts             # ALL types + IndexedDB schema (source of truth for data models)
│   ├── boxerStore.ts     # CRUD for boxers object store
│   ├── coachStore.ts     # CRUD for coaches object store
│   ├── gymStore.ts       # CRUD for gym (fixed ID=1 singleton)
│   ├── federationStore.ts# CRUD for federations object store
│   ├── fightStore.ts     # CRUD for fights object store
│   ├── fightContractStore.ts # CRUD for fightContracts object store
│   ├── ppvNetworkStore.ts# CRUD for ppvNetworks object store
│   ├── titleStore.ts     # CRUD for titles object store
│   ├── calendarEventStore.ts # CRUD for calendarEvents object store
│   ├── federationEventStore.ts # CRUD for federationEvents object store
│   ├── transactionStore.ts # CRUD for gym financial transactions
│   ├── saveData.ts       # Export/import full game state as versioned JSON
│   ├── initGame.ts       # Checks if world data exists; runs worldGen if not
│   └── worldGen.ts       # Procedural world generation (federations + fighters for all weight classes)
├── lib/
│   ├── fightSim.ts       # Interactive fight simulation (round-by-round with player tactics)
│   ├── npcFightSim.ts    # Headless NPC vs NPC fight simulation
│   ├── rankSystem.ts     # Boxer rank point system (REPUTATION_ORDER, RANK_CONFIG)
│   ├── reputationIndex.ts# Utility to look up reputation level by index
│   ├── training.ts       # Training exp accumulation + pre-fight camp stat boosts
│   ├── simTime.ts        # Game date advancement, monthly salary deductions
│   ├── ppvCalc.ts        # PPV payout calculations
│   └── coachSalaries.ts  # Coach monthly salary helpers
└── pages/
    ├── Dashboard/        # Dashboard.tsx
    ├── Fight/            # FightPage.tsx (interactive round-by-round), FightResultsPage.tsx
    ├── Gym/              # GymLayout, Roster, Coaches, Finances
    ├── Info/             # InfoPage.tsx — game reference + Export/Import Save
    ├── League/           # LeagueLayout, Standings, Calendar, Schedule, ContractNegotiation,
    │                     #   PpvSignup, RecentResults, ChampionshipHistory
    ├── Player/           # PlayerPage.tsx (boxer detail), EditBoxerPage.tsx (god mode edit)
    ├── Players/          # PlayersLayout, Compare, Recruiting, CoachRecruiting
    └── Tools/            # ToolsLayout, GodMode
```

---

## Data Models (all in `src/db/db.ts`)

### Key Types

```ts
type WeightClass = 'flyweight' | 'lightweight' | 'welterweight' | 'middleweight' | 'heavyweight'
type FightingStyle = 'out-boxer' | 'swarmer' | 'slugger' | 'counterpuncher'
type ReputationLevel = 'Unknown' | 'Local Star' | 'Rising Star' | 'Respectable Opponent'
                     | 'Contender' | 'Championship Caliber' | 'Nationally Ranked'
                     | 'World Class Fighter' | 'International Superstar' | 'All-Time Great'
type CoachSkillLevel = 'local' | 'contender' | 'championship-caliber' | 'all-time-great'
type FederationName  = 'North America Boxing Federation' | 'South America Boxing Federation'
                     | 'African Boxing Federation' | 'European Boxing Federation'
                     | 'Asia Boxing Federation' | 'Oceania Boxing Federation'
                     | 'International Boxing Federation'
type FightMethod     = 'KO' | 'TKO' | 'Decision' | 'Split Decision' | 'Draw'
type ContractStatus  = 'pending' | 'accepted' | 'countered' | 'rejected' | 'completed'
type CalendarEventType = 'fight' | 'training-camp'
type TransactionCategory = 'fight_payout' | 'ppv_payout' | 'coach_salary' | 'gym_upgrade' | 'recruit_bonus'
```

### Boxer

```ts
interface Boxer {
  id?: number;
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;        // null = AI-controlled (not in player gym)
  federationId: number | null; // federation the boxer competes in
  stats: BoxerStats;
  naturalTalents: NaturalTalent[];
  injuries: Injury[];
  titles: TitleRecord[];       // titles currently/previously held
  record: FightRecord[];       // professional fight history
  trainingExp?: Partial<Record<keyof BoxerStats, number>>;
  tempStatBoost?: { stats: Partial<BoxerStats>; expiresOnFightId: number };
  rankPoints: number;
  demotionBuffer: number;
  nextFightDate?: string;      // ISO date — NPC scheduling only
  lastRankDelta?: { points: number; bufferPoints: number; promoted: boolean; demoted: boolean };
}
```

### BoxerStats (1–20 scale; natural talent raises cap to 25)

```ts
interface BoxerStats {
  // Offense
  jab; cross; leadHook; rearHook; uppercut;
  // Defense
  headMovement; bodyMovement; guard; positioning;
  // Mental
  timing; adaptability; discipline;
  // Physical
  speed; power; endurance; recovery; toughness;
}
```

### Style focus stats

| Style          | Primary stats |
|----------------|---------------|
| out-boxer      | jab, cross, headMovement, guard, positioning, speed |
| swarmer        | leadHook, rearHook, bodyMovement, positioning, endurance, toughness |
| slugger        | rearHook, uppercut, power, endurance, recovery, toughness |
| counterpuncher | timing, adaptability, discipline, headMovement, bodyMovement, speed |

### Other key entities

```ts
interface Federation { id?; name: FederationName; prestige: number /* 1-10 */ }

interface Title {
  id?; federationId: number; weightClass: WeightClass;
  currentChampionId: number | null; reigns: TitleReign[];
}

interface Fight {
  id?; date: string; federationId: number; weightClass: WeightClass;
  boxerIds: number[]; winnerId: number | null;
  method: FightMethod; finishingMove: string | null;
  round: number | null; time: string | null;
  isTitleFight: boolean; contractId: number | null; // null = NPC fight
  roundLog?: RoundLogEntry[]; // populated for interactive player fights
}

interface FightContract {
  id?; boxerId: number; opponentId: number;
  federationId: number; weightClass: WeightClass;
  guaranteedPayout: number; ppvSplitPercentage: number;
  ppvNetworkId: number | null; isTitleFight: boolean;
  status: ContractStatus; counterOfferPayout: number | null;
  counterOfferPpvSplit: number | null; roundsUsed: number; // 0–3 negotiation rounds
  scheduledDate: string | null; fightId: number | null;
}

interface Gym {
  id?; name: string; level: number; balance: number;
  rosterIds: number[]; currentDate: string; // ISO — the game's current date
  recruitRefreshDate?: string; // YYYY-MM — last month the recruit pool was refreshed
  godModeEnabled?: boolean;
}
// Gym is a singleton — always stored with id=1. Use gymStore.ts saveGym/getGym.

interface Coach {
  id?; name: string; skillLevel: CoachSkillLevel; style: FightingStyle;
  assignedBoxerId: number | null; gymId: number | null; // null = available in recruiting pool
  monthlySalary: number;
}

interface CalendarEvent {
  id?; type: CalendarEventType; date: string; boxerIds: number[];
  fightId: number; endDate?: string; intensityLevel?: 'light' | 'moderate' | 'intense';
}

interface FederationEvent {
  id?; federationId: number; date: string; name: string; fightIds: number[];
}

interface GymTransaction {
  id?; date: string; description: string; amount: number;
  balanceAfter: number; category: TransactionCategory;
}
```

---

## IndexedDB Schema

Database name: `boxing-manager`, current version: **15**

| Store              | Key              | Indexes |
|--------------------|------------------|---------|
| `boxers`           | id (autoIncr)    | `weightClass`, `federationId` |
| `coaches`          | id (autoIncr)    | `style` |
| `gym`              | id (manual =1)   | — |
| `federations`      | id (autoIncr)    | `name` (unique) |
| `fights`           | id (autoIncr)    | `boxerIds` (multiEntry), `federationId` |
| `fightContracts`   | id (autoIncr)    | `boxerId`, `status` |
| `ppvNetworks`      | id (autoIncr)    | — |
| `titles`           | id (autoIncr)    | `federationId`, `weightClass` |
| `calendarEvents`   | id (autoIncr)    | `type`, `date`, `boxerIds` (multiEntry), `fightId` |
| `federationEvents` | id (autoIncr)    | `federationId`, `date` |
| `transactions`     | id (autoIncr)    | `date` |

**When adding a new object store, bump the version number in `db.ts` and add an `if (oldVersion < N)` block in the upgrade handler. Never mutate existing upgrade blocks.**

---

## Store API Pattern

All stores follow the same shape. Example for boxers:

```ts
getBoxer(id)                          // → Boxer | undefined
getAllBoxers()                         // → Boxer[]
getBoxersByWeightClass(weightClass)   // → Boxer[]
putBoxer(boxer)                       // → number (the saved id); works for insert + update
deleteBoxer(id)                       // → void
```

`putBoxer` (and all `put*` functions) handle both insert (no `id`) and update (has `id`) via IndexedDB's `put` semantics.

---

## Save Data (`src/db/saveData.ts`)

Exports and imports the full game state as a versioned JSON file.

```ts
exportSave(): Promise<void>
// Reads all 11 stores, serialises to { version, exportedAt, stores: {...} },
// triggers browser download as boxing-manager-save-YYYY-MM-DD.json

importSave(file: File): Promise<ImportResult>
// Parses + validates the file, clears all 11 stores, repopulates atomically.
// Returns ImportResult:
//   { ok: false; error: string }                          — bad file
//   { ok: true; versionMismatch: false }                  — success
//   { ok: true; versionMismatch: true; fileVersion: n }   — loaded with warning

const SAVE_VERSION = 1  // bump when schema changes require migration logic
```

The Export/Import UI lives in `src/pages/Info/InfoPage.tsx` (Save Data section at the bottom).

---

## World Generation (`src/db/worldGen.ts`)

Runs once on first launch (via `initGame.ts`) when both `boxers` and `federations` stores are empty.

**What it generates:**
- 7 federations with prestige values
- Fighters across all weight classes using a pyramid reputation distribution
- IBF gets a harder distribution (includes All-Time Great + International Superstar)
- Non-IBF federations have a 40% chance to include an International Superstar
- 1 title per federation per weight class; champion must be Championship Caliber or higher
- IBF champion must be Nationally Ranked or higher
- PPV networks seeded per federation

**Name generation:** uses `src/data/names.json` with federation-to-country mappings (e.g., North America BF → USA, Canada, Mexico, Dominican Republic, Puerto Rico).

---

## Startup Flow

```
initGameIfNeeded()      (src/db/initGame.ts)
  ├── getAllBoxers() + getAllFederations()
  └── if both empty → generateWorld()  (src/db/worldGen.ts)
        ├── putFederation × 7
        ├── putPpvNetwork per federation
        └── per federation × per weight class:
              ├── putBoxer × ~10
              └── putTitle × 1
```

React mounts only after `initGameIfNeeded()` resolves.

---

## Adding New Features — Checklist

1. **New entity type?** → Add interface + type to `db.ts`, bump DB version, add object store in upgrade handler.
2. **New store operations?** → Create `src/db/<entity>Store.ts` following the existing pattern.
3. **New page/route?** → Add component under `src/pages/`, register in `routes.tsx`.
4. **New world-gen content?** → Edit `worldGen.ts`; check that `initGame.ts` guard still works.
5. **Schema change?** → Always increment DB version; never mutate existing upgrade blocks.
6. **New export data?** → Update `SaveFile.stores` in `saveData.ts` and add the store to both `exportSave` and `importSave`. Bump `SAVE_VERSION` if the change is breaking.
