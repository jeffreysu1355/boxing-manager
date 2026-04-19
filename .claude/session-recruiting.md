# Session: Recruiting Page

## Status: Design approved, not yet implemented

## Spec
docs/superpowers/specs/2026-04-18-recruiting-page-design.md

## Tasks
- [x] Design brainstormed and approved
- [x] Update worldGen.ts — generate ~15 prospects (age 14-17, Unknown, amateur record) and ~25 free agents (age 22-35, weighted reputation distribution)
- [x] Build Recruiting.tsx — two sections (Prospects / Free Agents), gym balance callout, recruit action
- [x] Create Recruiting.module.css

## Key Decisions
- Recruitable boxers identified by: gymId=null + federationId=null + age<18 (prospect) or age>=18 (free agent)
- Pool generated at world gen (approach B), no refresh mechanic yet
- Signing bonus: Unknown $1k, Local Star $3k, Rising Star $8k, Respectable Opponent $20k, Contender $50k
- Gym level → max visible reputation: L1-2 Unknown, L3-4 Local Star, L5-7 Rising Star, L8-10 Respectable Opponent/Contender
- Rare tiers (<10% of pool) baked in at world gen via weighted distribution
- Recruit action: deduct bonus from gym.balance, set boxer.gymId, boxer leaves pool

## Key Files
- src/db/worldGen.ts — add prospect + free agent generation
- src/db/gymStore.ts — getGym / saveGym (already exist)
- src/db/boxerStore.ts — getAllBoxers or getBoxersByFederation
- src/pages/Players/Recruiting.tsx — target UI
- src/pages/Players/Recruiting.module.css — new

## DB Notes
- No new DB schema changes needed
- DB is currently at version 4
- IMPORTANT: user must clear IndexedDB when worldGen changes so new prospects/free agents are generated
