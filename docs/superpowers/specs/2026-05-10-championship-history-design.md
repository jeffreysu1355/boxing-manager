# Championship History — Design Spec

## Goal

A new "Championship History" page in the League tab shows the full reign history for every title belt, grouped by federation and weight class. The player page title badge links directly to the relevant belt section via a hash anchor.

## Data Model

No new DB structures needed. `Title` already has everything:

```ts
interface Title {
  id?: number;
  federationId: number;
  weightClass: WeightClass;
  currentChampionId: number | null;
  reigns: TitleReign[];  // chronological, oldest first
}

interface TitleReign {
  boxerId: number;
  dateWon: string;      // ISO
  dateLost: string | null;  // null = current champion
  defenseCount: number;
}
```

Boxer names are fetched by collecting all unique `boxerId`s across all reigns, then batch-fetching from `boxerStore`.

## Page: `/league/championship-history`

**File:** `src/pages/League/ChampionshipHistory.tsx`  
**CSS:** `src/pages/League/ChampionshipHistory.module.css`

### Layout

Federations rendered in the same order as Standings (prestige desc, IBF last). Within each federation, weight classes in a fixed order: Flyweight → Lightweight → Welterweight → Middleweight → Heavyweight.

Each title is a card with:
- An `id="title-{titleId}"` attribute for anchor scrolling
- Header: `{Federation Abbr} {Weight Class} Championship`
- If no reigns: "No recorded reigns yet."
- If reigns exist: a table with columns — **Boxer** (link to `/player/:id`), **Date Won**, **Date Lost** (or "Current" highlighted), **Days**, **Defenses**
- Reigns displayed newest-first (reverse chronological) so current champion is always at top
- Current champion row has a distinct highlight (accent-colored left border or background tint)

**Days** column: computed as `dateLost - dateWon` in days, or `today - dateWon` for the current reign (today = `gym.currentDate` fetched on load).

### Data loading

1. `getAllTitles()` — fetch all title records
2. `getAllFederations()` — to get names and sort order
3. Collect all unique `boxerId`s from all reigns across all titles
4. Batch `getBoxer(id)` for each unique boxer ID
5. Build a `Map<number, Boxer>` for name lookups

Use `cancelled` flag pattern on `useEffect`.

## Navigation

**Sidebar** (`src/components/Sidebar/Sidebar.tsx`): add `{ to: '/league/championship-history', label: 'Championship History' }` to the League section links.

**Route** (`src/routes.tsx`): add `{ path: 'championship-history', element: <ChampionshipHistory /> }` as a child of the `/league` route.

## Player Page Integration

**File:** `src/pages/Player/PlayerPage.tsx`

The current title badge (line ~247) is a `<span>`. Change it to a `<Link>` pointing to `/league/championship-history#title-{titleId}`.

The `titleFedMap` already has the `titleId` as the key, so the link can be constructed directly in the `.map()`.

Use `className={styles.titleBadge}` on the `<Link>` so styling is unchanged (needs `text-decoration: none` added to `.titleBadge` in the CSS module since it's currently a span).

## Weight Class Order

```ts
const WEIGHT_CLASS_ORDER: WeightClass[] = [
  'flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight',
];
```

## Federation Abbreviations

Reuse the existing `FEDERATION_ABBR` map from `src/constants/federations.ts`.

## Error / Empty States

- Loading: "Loading…" paragraph
- Title with no reigns: "No recorded reigns yet." in muted italic text
- Missing boxer (deleted from DB): display "Unknown Boxer" as the name, no link

## Files Changed

| Action | File |
|--------|------|
| Create | `src/pages/League/ChampionshipHistory.tsx` |
| Create | `src/pages/League/ChampionshipHistory.module.css` |
| Modify | `src/routes.tsx` |
| Modify | `src/components/Sidebar/Sidebar.tsx` |
| Modify | `src/pages/Player/PlayerPage.tsx` |
| Modify | `src/pages/Player/PlayerPage.module.css` |
