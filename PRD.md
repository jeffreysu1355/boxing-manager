# Boxing Manager - Project Requirements Document

> **Status**: In Development
> **Last Updated**: April 24, 2026
> **Progress Tracking**: This file is the source of truth for feature completion. See the Completion Tracking section in each feature area.
> **UI Inspiration**: [Football GM](https://play.football-gm.com/), World Boxing Manager
> **Reference Screenshots**: See `references/` directory

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Architecture](#2-technical-architecture)
3. [Data Models](#3-data-models)
4. [Gym System](#4-gym-system)
5. [Boxer System](#5-boxer-system)
6. [Coach System](#6-coach-system)
7. [Fight System](#7-fight-system)
8. [Federation & Organization System](#8-federation--organization-system)
9. [Financial System](#9-financial-system)
10. [UI & Navigation](#10-ui--navigation)
11. [Future Features](#11-future-features)

---

## 1. Project Overview

Boxing Manager is a browser-based simulation game where the player acts as a gym owner. The core gameplay loop is: recruit boxers and coaches, train boxers, schedule fights, earn money, and upgrade the gym to attract better talent. The ultimate goal is to develop boxers into world champions.

**Key Design Principles**:
- Text-based UI inspired by Football GM (simple, data-dense, functional)
- Client-side only, no backend server
- Simulator experience (no real-time in-fight control for now)

### Completion Tracking

- [x] Project scaffolding and tech stack setup
- [x] IndexedDB storage layer
- [ ] Core game engine / state management
- [x] UI shell and navigation
- [ ] Game loop (time progression)

---

## 2. Technical Architecture

- **Type**: Single-page application (SPA), runs entirely client-side
- **Storage**: IndexedDB for all game state persistence
- **Architecture Consideration**: Evaluate shared worker pattern (worker handles IndexedDB, main thread handles UI only) with a cache layer for frequently accessed data. Determine if this pattern is appropriate for the game's use case.
- **UI**: Text-based, no images required initially

### Completion Tracking

- [x] Choose SPA framework / tooling
- [x] Set up project build pipeline
- [x] Implement IndexedDB service layer (CRUD operations for all entities)
- [x] Evaluate and decide on shared worker architecture (decided against — not needed)
- [ ] Implement cache layer for frequently accessed data (if worker pattern adopted)
- [ ] Set up game state management
- [ ] Implement save/load game functionality

---

## 3. Data Models

All core entities that need to be defined and stored.

### Completion Tracking

- [x] Boxer model
- [x] Coach model
- [x] Gym model
- [x] Federation model
- [x] Fight record model
- [x] Fight contract model
- [x] PPV network model
- [x] Title model
- [x] Injury model
- [x] Calendar / event model
- [x] Natural talent model

---

## 4. Gym System

The gym is the player's central entity. All money flows to the gym. Gym level affects recruit quality and available equipment.

### Requirements

| Requirement | Details |
|---|---|
| Gym levels | 1 through 10 |
| Upgrade cost scaling | Increases per level; level 10 costs $100,000,000 |
| Higher level benefits | Better raw recruits, better training equipment, attracts better coaches |
| Money ownership | All fight earnings go to the gym, not individual boxers |

### Completion Tracking

- [x] Gym data model and initialization
- [x] Gym upgrade logic with cost scaling
- [x] Gym level affects recruit quality generation
- [x] Gym level affects coach attraction
- [x] Gym level affects training equipment effectiveness
- [x] Gym finances tracking (income, expenses, balance)

---

## 5. Boxer System

### 5.1 Weight Classes

| Class | Weight |
|---|---|
| Flyweight | 126 lbs |
| Lightweight | 135 lbs |
| Welterweight | 147 lbs |
| Middleweight | 160 lbs |
| Heavyweight | Over 200 lbs |

#### Completion Tracking

- [x] Weight class definitions and assignment

### 5.2 Reputation Levels

Ordered lowest to highest. Higher reputation = more prize money and ad revenue.

1. Unknown
2. Local Star
3. Rising Star
4. Respectable Opponent
5. Contender
6. Championship Caliber
7. Nationally Ranked
8. World Class Fighter
9. International Superstar
10. All-Time Great

#### Completion Tracking

- [x] Reputation level definitions
- [x] Reputation progression logic
- [ ] Reputation affects fight earnings

### 5.3 Fighting Styles

Four styles with a rock-paper-scissors counter system:

| Style | Countered By | Focus Stats |
|---|---|---|
| Out-Boxer | Swarmer | Jab, Cross, Head Movement, Guard, Positioning, Speed |
| Swarmer | Slugger | Lead Hook, Rear Hook, Body Movement, Positioning, Endurance, Toughness |
| Slugger | Counterpuncher | Rear Hook, Uppercut, Power, Endurance, Recovery, Toughness |
| Counterpuncher | Out-Boxer | Timing, Adaptability, Discipline, Head Movement, Body Movement, Speed |

#### Completion Tracking

- [x] Style definitions and counter relationships
- [x] Style affects fight outcome calculations
- [x] Style determines focus stats for training

### 5.4 Stats

Stats range from 1-20 (max 25 with natural talent). Organized into 4 categories:

| Category | Stats |
|---|---|
| Offense | Jab, Cross, Lead Hook, Rear Hook, Uppercut |
| Defense | Head Movement, Body Movement, Guard, Positioning |
| Mental | Timing, Adaptability, Discipline |
| Physical | Speed, Power, Endurance, Recovery, Toughness |

> See `references/boxer-stats.PNG` and `references/boxer-stats-full-image.PNG` for visual reference.

#### Completion Tracking

- [x] Stat definitions and categories
- [x] Stat value capping (1-20 normal, 1-25 with natural talent)
- [x] Stat display UI (inspired by football-gm, not exact copy of reference screenshots)
- [x] Stat generation for new boxers

### 5.5 Natural Talents

Randomly generated special abilities. A talent raises the max stat value from 20 to 25 for associated stats.

- Can be gained during character generation
- Can be randomly gained from training

#### Completion Tracking

- [x] Natural talent definitions and pool
- [x] Random talent assignment at generation
- [x] Random talent gain from training
- [x] Talent affects stat caps

### 5.6 Injuries

Boxers can be injured during training or fights. Injuries must be tracked.

#### Completion Tracking

- [x] Injury types and definitions
- [ ] Injury generation during training
- [ ] Injury generation during fights
- [ ] Injury recovery system
- [ ] Injury affects boxer availability and stats

### 5.7 Professional Record

Each boxer maintains a fight history. Format:
```
Win: Zach Pitt - KO (Rear Hook) - Rd. 1 (1:34) - North America Boxing Federation - April 14 2026
```

Record fields: Result (Win/Loss/Draw), Opponent Name, Method (KO/TKO/Decision/etc.), Finishing Move (if applicable), Round, Time, Federation, Date.

#### Completion Tracking

- [x] Fight record data model
- [x] Record auto-generated after each fight
- [x] Record display UI on boxer detail page

### 5.8 Titles

Boxers can hold federation titles. Track which titles are held and the date ranges.

#### Completion Tracking

- [x] Title data model (federation, weight class, holder, date acquired, date lost)
- [x] Title assignment on fight win (when title fight)
- [x] Title history display on boxer profile

### 5.9 Boxer Recruitment

Prospects are under-18 with visible stats and youth boxing history.

#### Completion Tracking

- [x] Prospect generation system
- [x] Youth stats and history generation
- [x] Recruitment UI (Players > Recruiting tab)
- [x] Gym level affects prospect quality

---

## 6. Coach System

Coaches must be recruited like boxers. Better gyms attract better coaches.

### Requirements

| Requirement | Details |
|---|---|
| Coach skill levels | Local, Contender, Championship Caliber, All Time Great |
| Style specialization | Each coach trains a specific fighting style |
| Cross-style training | A coach CAN train other styles, but the style-specific stats won't be increased |
| Season training | Boxers gain EXP per day in the coach's specialty stats |
| Pre-fight training | No EXP gain; instead 300% temporary stat boost, scaling with number of training days before the match |
| Gym level effect | Higher gym level attracts higher skill level coaches |

### Completion Tracking

- [x] Coach data model (name, skill level, style specialty)
- [x] Coach recruitment system
- [x] Gym level affects available coach quality
- [x] Coach assignment to boxers
- [x] Season training: daily EXP gain calculation
- [x] Pre-fight training: temporary 300% stat boost calculation
- [x] Pre-fight boost scales with training days
- [x] Coach management UI (Gym > Coaches tab)

---

## 7. Fight System

### 7.1 Fight Scheduling

Players challenge boxers in federations for fights at federation events.

| Requirement | Details |
|---|---|
| Events per federation | 4 per year |
| Guaranteed payout tiers | $1k-$10k (by $1k), $10k-$100k (by $10k), $100k-$1M (by $100k) |
| PPV/Network split | Boxer earns a percentage of PPV revenue |
| Title fights | Optional; winner takes the title |
| Opponent negotiation | Opponent can counter-offer, lower payout, negotiate PPV %, or reject |
| Rejection conditions | Challenger reputation too low, or not enough money offered |

#### Completion Tracking

- [x] Fight scheduling UI
- [x] Guaranteed payout tier selection
- [x] PPV percentage negotiation
- [x] Title fight option
- [x] AI opponent negotiation logic
- [x] AI opponent acceptance/rejection logic
- [x] Calendar integration for scheduled fights

### 7.2 PPV Networks

After scheduling but before the fight, the player can sign up with a PPV network.

| Requirement | Details |
|---|---|
| Network viewership | Each network has a viewer count |
| Expected viewers | 60% of network viewers watch the fight |
| Title fight bonus | Higher viewer percentage for title fights |
| Payout | Player receives their contract-determined PPV % of revenue |

#### Completion Tracking

- [x] PPV network data model and generation
- [x] Network signup UI (post-scheduling, pre-fight)
- [x] Viewer calculation (60% base, bonus for title fights)
- [x] PPV revenue calculation and payout

### 7.3 Fight Simulation

The fight can be auto-simmed or played interactively. Auto-sim resolves in one pass; interactive play is round-based.

| Factor | Weight |
|---|---|
| Fighter type matchup (style counters) | 20% |
| Stats comparison | 70% |
| Random chance | 10% |

Fight result must produce a record entry with: winner, method (KO, TKO, Decision, etc.), round, time, and all other record fields.

#### Completion Tracking

- [x] Fight simulation engine (auto-sim)
- [x] Style matchup advantage calculation (20%)
- [x] Stats comparison calculation (70%)
- [x] Random factor (10%)
- [x] Determine fight method (KO, TKO, Decision, etc.)
- [x] Determine round and time of finish
- [x] Generate fight record entries for both boxers
- [x] Post-fight reputation updates
- [ ] Post-fight injury generation
- [x] Post-fight title transfer (if title fight)
- [x] Post-fight financial payout

### 7.4 Interactive Fight Tactics (Round-Based)

When the player clicks "Play Fight" instead of "Sim Fight", a round-based interactive fight UI activates. 12 rounds by default.

| Mechanic | Details |
|---|---|
| Trigger | "Play Fight" on fight day navigates to `/fight/{fightId}`; fight is unresolved |
| Round structure | 12 rounds; player picks **category focus** + **stat spotlight** each round |
| Category focus | One of: Offense, Defense, Mental, Physical — moderate boost to all stats in that category |
| Stat spotlight | One specific stat within (or outside) the chosen category — extra boost on top of category focus |
| Stamina drain | `drain = 12 - (endurance * 0.8 + toughness * 0.4) / 2` per round; clamped 2–15%/round |
| Stamina debuff | `effectiveStats = stats * (0.4 + 0.6 * stamina / 100)`; at 0% stamina = 40% effective stats |
| Adaptation penalty | Repeating the same stat: `penalty = min(0.5, repeatCount * 0.10)`; if opponent adaptability ≥ 15 → 0.15/repeat; resets on switch |
| Health pool | Each boxer starts at 100%; damage dealt/taken each round reduces health |
| Scorecard | 10-point must system runs in parallel; difference ≥ 4 pts at end = Decision, < 4 = Split Decision |
| KO/TKO | Health ≤ 0 = KO; health 1–15 at round end + dominated = TKO |
| Opponent visibility | Opponent health %, stamina %, and fighting style shown; stats hidden |
| Body outline | SVG silhouette — player side shows damage zones (green→yellow→red per region); opponent side shows threat zones based on their style |
| Adaptation warning | Badge on focused stat if `repeatCount ≥ 2` showing current penalty |
| AI opponent | Picks category/stat each round based on its style's focus stats (deterministic) |
| Session checkpoint | `FightState` saved to `sessionStorage` after each round; hydrated on page reload |
| Round log | Every round logged as `RoundLogEntry` (damage, scores, narrative, penalty); stored on `Fight` record in IndexedDB |
| Post-fight recap | Round-by-round log shown in `FightPage` before routing to fight results page |

#### Completion Tracking

- [ ] `RoundLogEntry`, `FightState`, `StatCategory` types in `fightSim.ts`
- [ ] `simulateRound` pure function (stamina, effective stats, adaptation penalty, damage, scoring)
- [ ] AI opponent tactical choice logic
- [ ] Fight termination logic (KO/TKO/Decision/Split Decision)
- [ ] Extend `FightSimResult` with optional `roundLog`
- [ ] Extend `applyFightResult` to persist `roundLog` on `Fight` record
- [ ] `FightPage.tsx` interactive fight UI (health/stamina bars, body outline SVG, stat picker)
- [ ] sessionStorage checkpoint (write after each round, hydrate on mount, clear on finish)
- [ ] Post-fight recap view in `FightPage` with round-by-round log
- [ ] DB version bump to 15 (`roundLog` field on `Fight`)


---

## 8. Federation & Organization System

### Federations

| Federation | Notes |
|---|---|
| North America Boxing Federation | |
| South America Boxing Federation | |
| African Boxing Federation | |
| European Boxing Federation | |
| Asia Boxing Federation | |
| Oceania Boxing Federation | |
| International Boxing Federation | Most prestige and viewers |

Each federation:
- Hosts 4 events per year
- Has a title belt for each weight class
- Maintains rankings/standings

### Completion Tracking

- [x] Federation data model
- [x] 4 events per year per federation (event scheduling/calendar)
- [x] Title belt per weight class per federation
- [x] Federation standings/rankings
- [x] AI boxer pool per federation
- [x] International Boxing Federation prestige modifier

---

## 9. Financial System

All revenue flows to the gym.

### Revenue Sources
- Guaranteed fight payouts
- PPV percentage revenue
- Ad revenue (scales with boxer reputation)

### Expenses
- Gym upgrades
- Coach recruitment/salaries (TBD)
- Other operational costs (TBD)

### Completion Tracking

- [x] Financial ledger / transaction history
- [x] Revenue from guaranteed payouts
- [x] Revenue from PPV splits
- [ ] Ad revenue scaling with reputation
- [x] Gym upgrade purchase flow
- [x] Financial summary UI (Gym > Finances tab)

---

## 10. UI & Navigation

Text-based, data-dense UI inspired by Football GM. See `references/football-gm-ui-sample.PNG`.

### Main Navigation Tabs

#### League
- [x] **Standings**: Titles and contender rankings by federation and weight class. Title holder at top, contenders below.
- [x] **Calendar**: Upcoming fights for gym members

#### Gym
- [x] **Roster**: Current gym members with summary info (next fight, status). Click name for detailed boxer profile.
- [x] **Finances**: Gym level, balance, income/expense overview
- [x] **Coaches**: Current coaches, their specialties, and assigned boxers

#### Players
- [x] **Recruiting**: Under-18 prospects with stats and youth boxing history
- [ ] **Compare**: Side-by-side comparison of two selected fighters

#### Tools
- [x] **God Mode**: Modify any boxer's stats, natural talents, and history

#### Info
- [x] **Game Info page**: Reference guide showing fighting style stat focuses, style counter cycle, and reputation ladder

### General UI

- [x] App shell with top-level tab navigation
- [x] Sub-tab navigation within each section
- [x] Boxer detail/profile page (stats, record, titles, injuries, talents)
- [ ] Responsive text-based layout
- [x] Dashboard / home page

---

## 11. Future Features

These are NOT in scope for the initial build but are noted for future consideration.

- [ ] In-fight tactics system (real-time or turn-based fight control)
- [ ] Boxer aging and retirement
- [ ] Multiplayer / online features
- [ ] Historical stats and hall of fame
- [ ] Boxer morale / personality system

---

## Completion Summary

| Section | Status |
|---|---|
| Project Scaffolding | **Complete** |
| Technical Architecture | **In Progress** |
| Data Models | **Complete** |
| Gym System | **In Progress** |
| Boxer System | **In Progress** |
| Coach System | **In Progress** |
| Fight System | **In Progress** |
| Federation System | **Complete** |
| Financial System | **In Progress** |
| UI & Navigation | **In Progress** |

> Update this table as sections are completed. Use **Not Started**, **In Progress**, or **Complete**.
