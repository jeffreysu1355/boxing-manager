# Boxer Import/Export Design

**Date:** 2026-05-17

## Overview

Allow users to export any boxer to a JSON file and import boxers from JSON into a new game session. Import is restricted to God Mode. The import flow routes through a variant of EditBoxerPage so the user can review and adjust stats before the boxer is added to the gym roster.

## Export Format

```ts
interface BoxerExport {
  exportVersion: 1;
  boxer: Omit<Boxer, 'id'>;
}
```

- `id` is stripped on export so the boxer receives a fresh auto-incremented ID on import.
- All other `Boxer` fields are included: `name`, `age`, `weightClass`, `style`, `reputation`, `gymId`, `federationId`, `stats`, `naturalTalents`, `injuries`, `titles`, `record`, `trainingExp`, `tempStatBoost`, `rankPoints`, `demotionBuffer`, `nextFightDate`, `birthDate`, `lastAgedYear`, `retired`, `hofScore`, `lastRankDelta`.
- `exportVersion: 1` enables forward-compatibility checks on import.
- The download filename is `boxer-<name>.json` (name lowercased, spaces replaced with hyphens).

## Export Utility

A shared function `exportBoxer(boxer: Boxer): void` lives in `src/lib/exportBoxer.ts`. It:
1. Builds the `BoxerExport` object (strips `id`, adds `exportVersion: 1`).
2. Serializes to JSON with `JSON.stringify(..., null, 2)`.
3. Creates a `Blob` with `type: 'application/json'`.
4. Triggers a download via a temporary `<a>` element with `download` attribute.

## Export Button Placement

Both locations are gated on `godModeEnabled`:

- **PlayerPage** — "Export" button in the header area alongside the existing "Edit Boxer" link. Calls `exportBoxer(boxer)` directly.
- **EditBoxerPage** — "Export" button in the actions row alongside Save/Cancel. Exports the boxer's current saved state (the original `boxer` object, not the in-progress edits).

## Import Flow

### God Mode Page

A new "Import Boxer" section appears below the existing God Mode toggle. It contains:
- A file input (`accept=".json"`)
- An "Import" button
- An inline error area for validation messages

On clicking Import:
1. Read the selected file as text.
2. Parse JSON and validate:
   - `exportVersion === 1`
   - Required fields present: `name` (string), `stats` (object with all 17 stat keys), `record` (array), `reputation` (valid `ReputationLevel`), `weightClass` (valid `WeightClass`), `style` (valid `FightingStyle`), `rankPoints` (number), `demotionBuffer` (number), `naturalTalents` (array), `injuries` (array), `titles` (array).
3. If invalid: show inline error, do not navigate.
4. If valid: call `navigate('/player/import/edit', { state: { boxer: parsedBoxer } })`.

### Import Edit Page (`/player/import/edit`)

A new page at `src/pages/Player/ImportBoxerPage.tsx`. It reads `location.state.boxer` (a `Partial<Boxer>` without `id`). If `location.state` is missing (e.g. user navigated directly), redirect to `/tools/god-mode`.

The page renders the same editing UI as `EditBoxerPage` (stats, natural talents, age, reputation, ranking) pre-populated with the imported boxer's data. The page title is "Import Boxer".

**On Save:**
1. Load the current gym.
2. For each `FightRecord` in `boxer.record`: query all boxers in the current session. If exactly one boxer is found whose `name` exactly matches `record.opponentName`, set `record.opponentId` to that boxer's current `id`. Otherwise set `opponentId` to `null`.
3. Call `putBoxer({ ...boxer, gymId: gym.id, id: undefined })` to get the new auto-incremented `id`.
4. Call `saveGym({ ...gym, rosterIds: [...gym.rosterIds, newId] })`.
5. Navigate to `/player/:newId`.

**On Cancel:** Navigate to `/tools/god-mode`.

## Route Registration

Add `{ path: 'player/import/edit', element: <ImportBoxerPage /> }` to `src/routes.tsx` alongside the existing `player/:id` and `player/:id/edit` routes.

## Fight Record Link Resolution

The `opponentId` field on `FightRecord` is what PlayerPage uses to render clickable opponent links. On import save, the resolution pass sets `opponentId` to the matched boxer's current `id` if exactly one boxer with that name exists in the session, or `null` if no match is found. This is a one-time pass — no re-resolution on subsequent loads.

Records with `opponentId: null` display the opponent name as plain text. Records with a valid `opponentId` display as a `<Link to="/player/:opponentId">` as they do today.

## Out of Scope

- Bulk export/import (multiple boxers at once).
- Importing fight objects or federation event history.
- Re-resolving fight record links after new boxers are added post-import.
- Exporting/importing coaches or gym state.
