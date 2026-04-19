# Data Models Design: Title, Injury, Calendar/Event, Natural Talent

**Date:** 2026-04-18  
**Status:** Approved

---

## Overview

This spec defines the implementation of four data models for Boxing Manager. Two are new standalone IndexedDB object stores (`titles`, `calendarEvents`). Two are type-only changes to existing embedded interfaces (`NaturalTalent`, `Injury`).

---

## 1. Natural Talent

**Type change only — no new IDB store.**

Simplify the existing `NaturalTalent` interface. A talent is tied to exactly one stat; its display name is always derived as `"Super " + capitalize(stat)`. Having a talent raises that stat's cap from 20 to 25.

```typescript
export interface NaturalTalent {
  stat: keyof BoxerStats;
}
```

- `Boxer.naturalTalents: NaturalTalent[]` stays embedded on the boxer record.
- `affectedStats: (keyof BoxerStats)[]` is removed — replaced by the single `stat` field.
- Display name: `"Super Jab"`, `"Super Cross"`, etc.
- Stat enforcement: when training or god-mode sets a stat, cap = 25 if boxer has that talent, else 20.

---

## 2. Injury

**No structural changes — existing interface is sufficient.**

```typescript
export interface Injury {
  name: string;
  severity: 'minor' | 'moderate' | 'severe';
  recoveryDays: number;
  dateOccurred: string; // ISO date string
}
```

- Stays embedded on `Boxer.injuries: Injury[]`.
- No standalone IDB store — no need to query gym-wide injuries.
- Active/recovered status is derived at runtime: `dateOccurred + recoveryDays > today`.

---

## 3. Title

**New standalone `titles` IDB object store.**

### Interfaces

```typescript
export interface TitleReign {
  boxerId: number;
  dateWon: string;   // ISO date string
  dateLost: string | null; // null = current holder
  defenseCount: number;
}

export interface Title {
  id?: number;
  federationId: number;
  weightClass: WeightClass;
  currentChampionId: number | null; // null = vacant
  reigns: TitleReign[];
}
```

### IDB Store

- Store name: `titles`
- Key path: `id` (auto-increment)
- Indexes:
  - `federationId` — query all titles for a federation
  - `weightClass` — query all titles for a weight class
  - Compound lookup via JS filter (no compound IDB index needed)

### Impact on existing types

- `FederationTitle` (embedded on `Federation.titles[]`) is **removed**. The `titles` store is the source of truth for which boxer holds which belt. `Federation.titles` field is removed from the `Federation` interface.
- `TitleRecord` (embedded on `Boxer.titles[]`) is simplified:

```typescript
export interface TitleRecord {
  titleId: number;
  dateWon: string;
  dateLost: string | null;
}
```

`federationId` and `weightClass` are removed from `TitleRecord` — they are derived from the referenced `Title` record.

### New store file: `titleStore.ts`

CRUD operations: `getTitle`, `getAllTitles`, `getTitlesByFederation`, `getTitlesByWeightClass`, `putTitle`, `deleteTitle`.

---

## 4. Calendar/Event

**New standalone `calendarEvents` IDB object store.**

### Interface

```typescript
export type CalendarEventType = 'fight' | 'training-camp';

export interface CalendarEvent {
  id?: number;
  type: CalendarEventType;
  date: string;         // ISO date — fight date OR training camp start date
  boxerIds: number[];   // multi-entry indexed; single element for training-camp
  fightId: number;      // 'fight': the fight itself; 'training-camp': the fight being prepped for
  endDate?: string;     // training-camp only — ISO date
  intensityLevel?: 'light' | 'moderate' | 'intense'; // training-camp only
}
```

### IDB Store

- Store name: `calendarEvents`
- Key path: `id` (auto-increment)
- Indexes:
  - `type` — filter fights vs training camps
  - `date` — sort/range queries by date
  - `boxerIds` (multi-entry) — all events involving a boxer
  - `fightId` — find the event for a given fight, or find a training camp by its target fight

### Constraints

- Fight metadata (federation, weightClass, isTitleFight) lives on the `Fight` record — `CalendarEvent` only references it via `fightId`.
- A training camp's `fightId` must reference an existing `Fight` record.
- `endDate` must be before `date` of the referenced fight for training camps.

### New store file: `calendarEventStore.ts`

CRUD operations: `getCalendarEvent`, `getAllCalendarEvents`, `getEventsByBoxer`, `getEventsByFight`, `getEventsByType`, `putCalendarEvent`, `deleteCalendarEvent`.

---

## DB Version Bump

Adding two new object stores (`titles`, `calendarEvents`) requires a version bump: **version 2 → 3**.

The upgrade block for version 3 creates both stores and their indexes. Existing data in version 2 stores is unaffected.

---

## Summary of Changes

| Model | Change type | Store |
|---|---|---|
| NaturalTalent | Interface change (`stat` replaces `affectedStats`) | None (embedded) |
| Injury | No change | None (embedded) |
| Title | New interface + store | `titles` |
| CalendarEvent | New interface + store | `calendarEvents` |
| Federation | Remove `titles: FederationTitle[]` field | Existing `federations` store |
| TitleRecord | Simplify (remove `federationId`, `weightClass`) | Embedded on Boxer |
