# React Boilerplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a React + TypeScript SPA with Vite, set up routing, and build the app shell with navigation matching the Football GM-inspired layout (dark theme, top navbar, left sidebar, data-dense content area).

**Architecture:** Vite + React 18 + TypeScript. React Router for client-side navigation with nested routes for tab/sub-tab structure. CSS Modules for component-scoped styling with a global dark theme. No game logic or data layer — just the navigable UI shell with placeholder pages.

**Tech Stack:** Vite, React 18, TypeScript, React Router v7, CSS Modules

---

## File Structure

```
src/
├── main.tsx                    # App entry point, mounts React
├── App.tsx                     # Router setup, top-level layout
├── App.module.css              # Layout styles (top nav + sidebar + content grid)
├── index.css                   # Global styles, CSS variables, dark theme, resets
├── routes.tsx                  # Route definitions (centralized)
├── components/
│   ├── TopNav/
│   │   ├── TopNav.tsx          # Top navigation bar with main tabs
│   │   └── TopNav.module.css
│   ├── Sidebar/
│   │   ├── Sidebar.tsx         # Left sidebar with sub-tab links
│   │   └── Sidebar.module.css
│   └── PageHeader/
│       ├── PageHeader.tsx      # Reusable page title + subtitle header
│       └── PageHeader.module.css
├── pages/
│   ├── Dashboard/
│   │   └── Dashboard.tsx       # Home/dashboard page
│   ├── League/
│   │   ├── LeagueLayout.tsx    # League section layout (sidebar context)
│   │   ├── Standings.tsx       # League > Standings placeholder
│   │   └── Calendar.tsx        # League > Calendar placeholder
│   ├── Gym/
│   │   ├── GymLayout.tsx       # Gym section layout
│   │   ├── Roster.tsx          # Gym > Roster placeholder
│   │   ├── Finances.tsx        # Gym > Finances placeholder
│   │   └── Coaches.tsx         # Gym > Coaches placeholder
│   ├── Players/
│   │   ├── PlayersLayout.tsx   # Players section layout
│   │   ├── Recruiting.tsx      # Players > Recruiting placeholder
│   │   └── Compare.tsx         # Players > Compare placeholder
│   └── Tools/
│       ├── ToolsLayout.tsx     # Tools section layout
│       └── GodMode.tsx         # Tools > God Mode placeholder
```

---

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`

- [ ] **Step 1: Create Vite project**

Run:
```bash
cd C:\git\boxing-manager
npm create vite@latest . -- --template react-ts
```

When prompted about the non-empty directory, select "Ignore files and continue".

Expected: Vite scaffolds the project with `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, etc.

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 3: Install React Router**

Run:
```bash
npm install react-router
```

Expected: `react-router` added to `package.json` dependencies.

- [ ] **Step 4: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173` (or similar port). Kill the server after confirming.

- [ ] **Step 5: Clean up Vite defaults**

Delete these generated files we won't use:
- `src/App.css`
- `src/assets/react.svg`
- `public/vite.svg`

Keep `src/index.css` (we'll replace its contents) and `src/main.tsx` and `src/App.tsx` (we'll rewrite them).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx src/index.css src/vite-env.d.ts
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Global Styles and Dark Theme

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Write the global styles**

Replace `src/index.css` with:

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-surface: #0f3460;
  --bg-hover: #1a3a6a;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #707070;
  --accent: #e94560;
  --accent-hover: #ff6b81;
  --border: #2a2a4a;
  --success: #4caf50;
  --warning: #ff9800;
  --danger: #f44336;
  --font-mono: 'Consolas', 'Courier New', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --nav-height: 40px;
  --sidebar-width: 180px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  width: 100%;
}

body {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  color: var(--accent-hover);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

tr:hover {
  background-color: var(--bg-hover);
}
```

- [ ] **Step 2: Verify styles load**

Run:
```bash
npm run dev
```

Expected: Page loads with a dark background (`#1a1a2e`). Kill the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add global dark theme and CSS variables"
```

---

### Task 3: App Shell Layout

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.module.css`

- [ ] **Step 1: Write App layout styles**

Create `src/App.module.css`:

```css
.layout {
  display: grid;
  grid-template-rows: var(--nav-height) 1fr;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    "nav nav"
    "sidebar content";
  height: 100%;
}

.content {
  grid-area: content;
  padding: 16px 24px;
  overflow-y: auto;
}
```

- [ ] **Step 2: Write App component with Outlet**

Replace `src/App.tsx`:

```tsx
import { Outlet } from 'react-router';
import { TopNav } from './components/TopNav/TopNav';
import { Sidebar } from './components/Sidebar/Sidebar';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.layout}>
      <TopNav />
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
```

Note: This won't compile yet — TopNav and Sidebar don't exist. That's expected. We'll build them in Tasks 4 and 5.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat: add app shell grid layout with nav, sidebar, and content areas"
```

---

### Task 4: TopNav Component

**Files:**
- Create: `src/components/TopNav/TopNav.tsx`
- Create: `src/components/TopNav/TopNav.module.css`

- [ ] **Step 1: Write TopNav styles**

Create `src/components/TopNav/TopNav.module.css`:

```css
.topNav {
  grid-area: nav;
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  gap: 4px;
}

.brand {
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  margin-right: 24px;
  white-space: nowrap;
}

.tab {
  padding: 8px 14px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px 4px 0 0;
  transition: color 0.15s, background-color 0.15s;
}

.tab:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.activeTab {
  composes: tab;
  color: var(--text-primary);
  background-color: var(--bg-surface);
}
```

- [ ] **Step 2: Write TopNav component**

Create `src/components/TopNav/TopNav.tsx`:

```tsx
import { NavLink } from 'react-router';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/league', label: 'League' },
  { to: '/gym', label: 'Gym' },
  { to: '/players', label: 'Players' },
  { to: '/tools', label: 'Tools' },
];

export function TopNav() {
  return (
    <nav className={styles.topNav}>
      <span className={styles.brand}>Boxing Manager</span>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            isActive ? styles.activeTab : styles.tab
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TopNav/TopNav.tsx src/components/TopNav/TopNav.module.css
git commit -m "feat: add TopNav component with main tab navigation"
```

---

### Task 5: Sidebar Component

**Files:**
- Create: `src/components/Sidebar/Sidebar.tsx`
- Create: `src/components/Sidebar/Sidebar.module.css`

- [ ] **Step 1: Write Sidebar styles**

Create `src/components/Sidebar/Sidebar.module.css`:

```css
.sidebar {
  grid-area: sidebar;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 12px 0;
  overflow-y: auto;
}

.sectionLabel {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 8px 16px 4px;
  letter-spacing: 0.5px;
}

.link {
  display: block;
  padding: 6px 16px 6px 24px;
  color: var(--text-secondary);
  font-size: 13px;
  transition: color 0.15s, background-color 0.15s;
}

.link:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.activeLink {
  composes: link;
  color: var(--text-primary);
  background-color: var(--bg-surface);
  border-left: 3px solid var(--accent);
  padding-left: 21px;
}
```

- [ ] **Step 2: Write Sidebar component**

Create `src/components/Sidebar/Sidebar.tsx`:

```tsx
import { NavLink, useLocation } from 'react-router';
import styles from './Sidebar.module.css';

interface SidebarSection {
  label: string;
  links: { to: string; label: string }[];
}

const sidebarConfig: Record<string, SidebarSection[]> = {
  '/league': [
    {
      label: 'League',
      links: [
        { to: '/league/standings', label: 'Standings' },
        { to: '/league/calendar', label: 'Calendar' },
      ],
    },
  ],
  '/gym': [
    {
      label: 'Gym',
      links: [
        { to: '/gym/roster', label: 'Roster' },
        { to: '/gym/finances', label: 'Finances' },
        { to: '/gym/coaches', label: 'Coaches' },
      ],
    },
  ],
  '/players': [
    {
      label: 'Players',
      links: [
        { to: '/players/recruiting', label: 'Recruiting' },
        { to: '/players/compare', label: 'Compare' },
      ],
    },
  ],
  '/tools': [
    {
      label: 'Tools',
      links: [
        { to: '/tools/god-mode', label: 'God Mode' },
      ],
    },
  ],
};

function getSections(pathname: string): SidebarSection[] {
  const prefix = '/' + pathname.split('/')[1];
  return sidebarConfig[prefix] ?? [];
}

export function Sidebar() {
  const { pathname } = useLocation();
  const sections = getSections(pathname);

  if (sections.length === 0) {
    return <aside className={styles.sidebar} />;
  }

  return (
    <aside className={styles.sidebar}>
      {sections.map((section) => (
        <div key={section.label}>
          <div className={styles.sectionLabel}>{section.label}</div>
          {section.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/Sidebar.tsx src/components/Sidebar/Sidebar.module.css
git commit -m "feat: add Sidebar component with context-aware sub-navigation"
```

---

### Task 6: PageHeader Component

**Files:**
- Create: `src/components/PageHeader/PageHeader.tsx`
- Create: `src/components/PageHeader/PageHeader.module.css`

- [ ] **Step 1: Write PageHeader styles**

Create `src/components/PageHeader/PageHeader.module.css`:

```css
.header {
  margin-bottom: 16px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}
```

- [ ] **Step 2: Write PageHeader component**

Create `src/components/PageHeader/PageHeader.tsx`:

```tsx
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PageHeader/PageHeader.tsx src/components/PageHeader/PageHeader.module.css
git commit -m "feat: add PageHeader reusable component"
```

---

### Task 7: Placeholder Pages

**Files:**
- Create: `src/pages/Dashboard/Dashboard.tsx`
- Create: `src/pages/League/LeagueLayout.tsx`
- Create: `src/pages/League/Standings.tsx`
- Create: `src/pages/League/Calendar.tsx`
- Create: `src/pages/Gym/GymLayout.tsx`
- Create: `src/pages/Gym/Roster.tsx`
- Create: `src/pages/Gym/Finances.tsx`
- Create: `src/pages/Gym/Coaches.tsx`
- Create: `src/pages/Players/PlayersLayout.tsx`
- Create: `src/pages/Players/Recruiting.tsx`
- Create: `src/pages/Players/Compare.tsx`
- Create: `src/pages/Tools/ToolsLayout.tsx`
- Create: `src/pages/Tools/GodMode.tsx`

- [ ] **Step 1: Write Dashboard page**

Create `src/pages/Dashboard/Dashboard.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Boxing Manager 2026" />
      <p>Welcome to Boxing Manager. Use the tabs above to navigate.</p>
    </div>
  );
}
```

- [ ] **Step 2: Write League section pages**

Create `src/pages/League/LeagueLayout.tsx`:

```tsx
import { Outlet } from 'react-router';

export default function LeagueLayout() {
  return <Outlet />;
}
```

Create `src/pages/League/Standings.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Standings() {
  return (
    <div>
      <PageHeader title="Standings" subtitle="Title holders and contender rankings by federation" />
      <p>Standings will display here.</p>
    </div>
  );
}
```

Create `src/pages/League/Calendar.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Calendar() {
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
      <p>Calendar will display here.</p>
    </div>
  );
}
```

- [ ] **Step 3: Write Gym section pages**

Create `src/pages/Gym/GymLayout.tsx`:

```tsx
import { Outlet } from 'react-router';

export default function GymLayout() {
  return <Outlet />;
}
```

Create `src/pages/Gym/Roster.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Roster() {
  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <p>Roster will display here.</p>
    </div>
  );
}
```

Create `src/pages/Gym/Finances.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Finances() {
  return (
    <div>
      <PageHeader title="Finances" subtitle="Gym level and financial overview" />
      <p>Finances will display here.</p>
    </div>
  );
}
```

Create `src/pages/Gym/Coaches.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Coaches() {
  return (
    <div>
      <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
      <p>Coaches will display here.</p>
    </div>
  );
}
```

- [ ] **Step 4: Write Players section pages**

Create `src/pages/Players/PlayersLayout.tsx`:

```tsx
import { Outlet } from 'react-router';

export default function PlayersLayout() {
  return <Outlet />;
}
```

Create `src/pages/Players/Recruiting.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Recruiting() {
  return (
    <div>
      <PageHeader title="Recruiting" subtitle="Under-18 prospects with stats and youth boxing history" />
      <p>Recruiting will display here.</p>
    </div>
  );
}
```

Create `src/pages/Players/Compare.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function Compare() {
  return (
    <div>
      <PageHeader title="Compare" subtitle="Side-by-side fighter comparison" />
      <p>Compare tool will display here.</p>
    </div>
  );
}
```

- [ ] **Step 5: Write Tools section pages**

Create `src/pages/Tools/ToolsLayout.tsx`:

```tsx
import { Outlet } from 'react-router';

export default function ToolsLayout() {
  return <Outlet />;
}
```

Create `src/pages/Tools/GodMode.tsx`:

```tsx
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function GodMode() {
  return (
    <div>
      <PageHeader title="God Mode" subtitle="Modify stats, natural talents, and history" />
      <p>God Mode controls will display here.</p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/
git commit -m "feat: add placeholder pages for all navigation sections"
```

---

### Task 8: Route Definitions and App Wiring

**Files:**
- Create: `src/routes.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write centralized route config**

Create `src/routes.tsx`:

```tsx
import { Navigate, type RouteObject } from 'react-router';
import App from './App';
import Dashboard from './pages/Dashboard/Dashboard';
import LeagueLayout from './pages/League/LeagueLayout';
import Standings from './pages/League/Standings';
import Calendar from './pages/League/Calendar';
import GymLayout from './pages/Gym/GymLayout';
import Roster from './pages/Gym/Roster';
import Finances from './pages/Gym/Finances';
import Coaches from './pages/Gym/Coaches';
import PlayersLayout from './pages/Players/PlayersLayout';
import Recruiting from './pages/Players/Recruiting';
import Compare from './pages/Players/Compare';
import ToolsLayout from './pages/Tools/ToolsLayout';
import GodMode from './pages/Tools/GodMode';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'league',
        element: <LeagueLayout />,
        children: [
          { index: true, element: <Navigate to="standings" replace /> },
          { path: 'standings', element: <Standings /> },
          { path: 'calendar', element: <Calendar /> },
        ],
      },
      {
        path: 'gym',
        element: <GymLayout />,
        children: [
          { index: true, element: <Navigate to="roster" replace /> },
          { path: 'roster', element: <Roster /> },
          { path: 'finances', element: <Finances /> },
          { path: 'coaches', element: <Coaches /> },
        ],
      },
      {
        path: 'players',
        element: <PlayersLayout />,
        children: [
          { index: true, element: <Navigate to="recruiting" replace /> },
          { path: 'recruiting', element: <Recruiting /> },
          { path: 'compare', element: <Compare /> },
        ],
      },
      {
        path: 'tools',
        element: <ToolsLayout />,
        children: [
          { index: true, element: <Navigate to="god-mode" replace /> },
          { path: 'god-mode', element: <GodMode /> },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Wire up the router in main.tsx**

Replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import './index.css';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [ ] **Step 3: Verify the full app works**

Run:
```bash
npm run dev
```

Expected:
- Dark-themed page loads at `http://localhost:5173`
- Top nav shows: "Boxing Manager" brand + Dashboard, League, Gym, Players, Tools tabs
- Clicking "Dashboard" shows the dashboard page (no sidebar)
- Clicking "League" navigates to `/league/standings`, sidebar shows Standings and Calendar links
- Clicking "Gym" navigates to `/gym/roster`, sidebar shows Roster, Finances, Coaches links
- Clicking "Players" navigates to `/players/recruiting`, sidebar shows Recruiting, Compare links
- Clicking "Tools" navigates to `/tools/god-mode`, sidebar shows God Mode link
- Active top tab and sidebar link are visually highlighted
- All sub-tab links navigate to their placeholder pages

- [ ] **Step 4: Commit**

```bash
git add src/routes.tsx src/main.tsx
git commit -m "feat: wire up React Router with nested routes for all sections"
```

---

### Task 9: Add .gitignore and Update CLAUDE.md

**Files:**
- Modify: `.gitignore` (Vite should have created one, otherwise create it)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verify .gitignore exists and covers node_modules/dist**

Check that `.gitignore` includes at minimum:

```
node_modules
dist
.DS_Store
```

If Vite already created one, just verify it. If not, create it with the above content.

- [ ] **Step 2: Update CLAUDE.md with build commands**

Add the following section to the top of `CLAUDE.md`, after the header paragraph:

```markdown
## Build & Development Commands

- `npm run dev` — Start Vite dev server (hot reload)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally
```

- [ ] **Step 3: Update PRD completion tracking**

In `PRD.md`, check off these items:
- `[x] Project scaffolding and tech stack setup` (Section 1)
- `[x] Choose SPA framework / tooling` (Section 2)
- `[x] Set up project build pipeline` (Section 2)
- `[x] App shell with top-level tab navigation` (Section 10)
- `[x] Sub-tab navigation within each section` (Section 10)
- `[x] Dashboard / home page` (Section 10)

Update the Completion Summary table:
- Project Scaffolding: **Complete**
- Technical Architecture: **In Progress**
- UI & Navigation: **In Progress**

- [ ] **Step 4: Commit**

```bash
git add .gitignore CLAUDE.md PRD.md
git commit -m "chore: update gitignore, CLAUDE.md with dev commands, PRD tracking"
```

---

### Task 10: Build Verification

- [ ] **Step 1: Run production build**

Run:
```bash
npm run build
```

Expected: Build completes successfully with no TypeScript errors. Output goes to `dist/`.

- [ ] **Step 2: Run type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Preview production build**

Run:
```bash
npm run preview
```

Expected: Production build serves and all navigation works identically to dev mode. Kill server after confirming.
