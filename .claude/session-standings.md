# Session: Standings Page — Display Generated World

## Status: COMPLETE

## Changes Made
1. `src/db/db.ts` — Added `federationId: number | null` to `Boxer`, added `federationId` index to boxers schema, bumped DB version 3→4 with upgrade block
2. `src/db/worldGen.ts` — Set `federationId: fedId` when creating boxers
3. `src/db/boxerStore.ts` — Added `getBoxersByFederation(federationId)` query
4. `src/pages/League/Standings.tsx` — Full standings UI
5. `src/pages/League/Standings.module.css` — Styles

## NOTE: DB Reset Required
Because the DB version bumped (3→4), existing data in the browser has no `federationId` on boxers.
**User must clear IndexedDB** (DevTools → Application → IndexedDB → delete boxing-manager) to regenerate world with federation links.
