# Boxing Manager

A browser-based boxing gym management game. Recruit and train boxers, schedule fights, negotiate contracts, and grow your gym into a world-class operation.

## Prerequisites

- Node.js 18+
- npm 9+

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run lint` | Lint with ESLint |

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **React Router v7** for client-side routing
- **IndexedDB** (via `idb`) for all game state — no backend required
- **CSS Modules** with a global dark theme
- **Vitest** for unit tests

## Project Structure

```
src/
  components/   Shared UI components (TopNav, PageHeader, etc.)
  constants/    Game constants (federations, reputations, etc.)
  db/           IndexedDB stores and schema
  lib/          Pure game logic (aging, training, fight simulation)
  pages/        Route-level page components
    Gym/        Roster, Finances, Coaches, Retired
    League/     Schedule, Calendar, Standings, Contracts
    Players/    Recruiting, Compare
    Tools/      God Mode
docs/
  superpowers/specs/   Design specs for implemented features
references/     UI inspiration screenshots
```

## Notes

- All data lives in the browser's IndexedDB — clearing site data resets the game
- The game is entirely client-side; no server or network requests are made
