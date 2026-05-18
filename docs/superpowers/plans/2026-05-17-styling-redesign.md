# Styling Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Boxing Manager from CSS Modules + navy/red theme to shadcn/ui + Tailwind CSS with a charcoal/slate dark theme and orange accent.

**Architecture:** Install Tailwind CSS v4 and shadcn/ui into the existing Vite + React + TypeScript project. Add shared `Button` and `Badge` UI components to `src/components/ui/`. Update the global theme tokens in `index.css`, then migrate `TopNav`, `Sidebar`, `Roster`, and `PlayerPage` to use Tailwind utilities and the new shared components, replacing their CSS Module files. All other pages keep their CSS Modules unchanged for now.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI primitives), CSS Modules (coexisting during migration)

---

## File Map

**Created:**
- `src/components/ui/button.tsx` — shared Button component (shadcn/ui)
- `src/components/ui/badge.tsx` — shared Badge component (shadcn/ui)
- `src/lib/utils.ts` — cn() helper (Tailwind class merging)

**Modified:**
- `src/index.css` — swap color tokens to charcoal/slate/orange palette; add Tailwind directives
- `vite.config.ts` — add Tailwind plugin
- `package.json` — new dependencies
- `src/components/TopNav/TopNav.tsx` — replace CSS Module classes with Tailwind utilities
- `src/components/TopNav/TopNav.module.css` — deleted
- `src/components/Sidebar/Sidebar.tsx` — replace CSS Module classes with Tailwind utilities
- `src/components/Sidebar/Sidebar.module.css` — deleted
- `src/pages/Gym/Roster.tsx` — replace CSS Module classes with Tailwind + Button/Badge components
- `src/pages/Gym/Roster.module.css` — deleted
- `src/pages/Player/PlayerPage.tsx` — replace CSS Module classes with Tailwind + Badge component
- `src/pages/Player/PlayerPage.module.css` — deleted

---

## Task 1: Install Tailwind CSS v4 and configure Vite

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Install Tailwind CSS v4**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm install tailwindcss @tailwindcss/vite
```

Expected: Packages installed, no errors.

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

Replace the contents of `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
})
```

- [ ] **Step 3: Add Tailwind import to index.css and update color tokens**

Replace the full contents of `src/index.css` with:

```css
@import "tailwindcss";

:root {
  --bg-primary: #09090b;
  --bg-secondary: #18181b;
  --bg-surface: #27272a;
  --bg-hover: #3f3f46;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #f97316;
  --accent-hover: #fb923c;
  --border: #3f3f46;
  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;
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

- [ ] **Step 4: Verify the dev server starts without errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -20
```

Expected: Build succeeds (no TypeScript or Tailwind errors).

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -10
```

Expected: 421 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add vite.config.ts src/index.css package.json package-lock.json
git commit -m "chore: install Tailwind CSS v4 and update color tokens to charcoal/slate theme"
```

---

## Task 2: Add cn() utility and shadcn/ui Button component

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`

- [ ] **Step 1: Install clsx and tailwind-merge**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm install clsx tailwind-merge
```

Expected: Packages installed, no errors.

- [ ] **Step 2: Create the cn() utility**

Create `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Create the Button component**

Create `src/components/ui/button.tsx`:

```tsx
import { cn } from '../../lib/utils'

type ButtonVariant = 'default' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-50',
  ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100',
  danger: 'bg-transparent text-red-400 border border-red-500 hover:bg-red-950',
  outline: 'bg-transparent text-zinc-300 border border-zinc-600 hover:bg-zinc-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded font-medium cursor-pointer transition-colors disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/lib/utils.ts src/components/ui/button.tsx package.json package-lock.json
git commit -m "feat: add cn() utility and shared Button component"
```

---

## Task 3: Add shared Badge component

**Files:**
- Create: `src/components/ui/badge.tsx`

- [ ] **Step 1: Create the Badge component**

Create `src/components/ui/badge.tsx`:

```tsx
import { cn } from '../../lib/utils'

type BadgeVariant = 'accent' | 'warning' | 'success' | 'danger' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: 'text-orange-400 border-orange-500',
  warning: 'text-yellow-400 border-yellow-500',
  success: 'text-green-400 border-green-600',
  danger: 'text-red-400 border-red-500',
  muted: 'text-zinc-400 border-zinc-600',
}

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block border rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/components/ui/badge.tsx
git commit -m "feat: add shared Badge component"
```

---

## Task 4: Migrate TopNav to Tailwind

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`
- Delete: `src/components/TopNav/TopNav.module.css`

- [ ] **Step 1: Replace TopNav.tsx with Tailwind version**

Replace the import line `import styles from './TopNav.module.css';` and all `className={styles.*}` usages in `src/components/TopNav/TopNav.tsx` with Tailwind utility classes. The return JSX should become:

```tsx
  return (
    <div className="flex flex-col" style={{ gridArea: 'nav' }}>
      <nav className="flex items-center bg-zinc-900 border-b border-zinc-700 px-4 gap-1">
        <span className="font-bold text-sm text-orange-500 mr-4 whitespace-nowrap">Boxing Manager</span>

        <div className="relative flex items-center gap-2 mr-4" ref={dropdownRef}>
          <span className="text-sm text-zinc-400 whitespace-nowrap">{formatGameDate(currentDate)}</span>
          <Button
            onClick={() => setDropdownOpen(o => !o)}
            disabled={isSimming}
            size="sm"
          >
            {isSimming ? 'Simming...' : 'Play ▾'}
          </Button>
          {dropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 bg-zinc-800 border border-zinc-700 rounded min-w-[180px] z-[100] shadow-lg">
              {isOnFightDay ? (
                <>
                  <button className="block w-full px-4 py-2.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 bg-transparent border-none cursor-pointer" onClick={handlePlayFight}>
                    Play Fight
                  </button>
                  <button className="block w-full px-4 py-2.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 bg-transparent border-none cursor-pointer" onClick={handleSimFight}>
                    Sim Fight
                  </button>
                </>
              ) : (
                <>
                  <button className="block w-full px-4 py-2.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 bg-transparent border-none cursor-pointer" onClick={() => handleSim(7)}>
                    Sim 1 Week
                  </button>
                  <button className="block w-full px-4 py-2.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 bg-transparent border-none cursor-pointer" onClick={() => handleSim(21)}>
                    Sim 1 Month
                  </button>
                  <button className="block w-full px-4 py-2.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 bg-transparent border-none cursor-pointer" onClick={() => handleSim('next')}>
                    Sim to Next Event
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              isActive
                ? 'px-3.5 py-2 text-sm font-medium rounded-t text-zinc-100 bg-zinc-800'
                : 'px-3.5 py-2 text-sm font-medium rounded-t text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {fightStop && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-start gap-2 border-t border-black/20">
          <strong>Fight Day!</strong> A scheduled fight has arrived on{' '}
          {formatGameDate(fightStop.date)}.{' '}
          <button
            className="ml-auto flex-shrink-0 self-start px-2.5 py-0.5 text-xs bg-white/20 text-white border border-white/40 rounded cursor-pointer hover:bg-white/30"
            onClick={() => setFightStop(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {simmedFights.length > 0 && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-start gap-2 border-t border-black/20">
          <div className="flex flex-col gap-1 flex-1">
            <strong>Fight Day Results</strong>
            {simmedFights.map((f, i) => {
              const isDecision = f.method === 'Decision' || f.method === 'Split Decision';
              const summary = f.winnerId === null
                ? 'Draw'
                : isDecision
                  ? `${f.boxer1Name} wins by ${f.method}`
                  : `${f.boxer1Name} wins by ${f.method}${f.finishingMove ? ` (${f.finishingMove})` : ''}${f.round != null ? ` — Rd. ${f.round}` : ''}`;
              return (
                <div key={f.fightId}>
                  {i > 0 && <hr className="border-none border-t border-white/25 my-1" />}
                  <div className="text-xs text-white">{summary}</div>
                </div>
              );
            })}
            <button
              className="text-white text-xs font-semibold underline bg-transparent border-none cursor-pointer p-0 mt-1 text-left"
              onClick={() => navigate(`/fight-results?fights=${simmedFights.map(f => f.fightId).join(',')}`)}
            >
              View Full Results →
            </button>
          </div>
          <button className="ml-auto flex-shrink-0 self-start px-2.5 py-0.5 text-xs bg-white/20 text-white border border-white/40 rounded cursor-pointer hover:bg-white/30" onClick={() => setSimmedFights([])}>Dismiss</button>
        </div>
      )}

      {rankChanges.length > 0 && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-start gap-2 border-t border-black/20">
          <div className="flex flex-col gap-1 flex-1">
            {rankChanges.map((change, i) => {
              const { name, delta, reputation } = change;
              if (delta.promoted) return (
                <div key={i} className="text-xs text-white">
                  <span className="text-green-300 font-bold">{name}: Promoted to {reputation}!</span>
                </div>
              );
              if (delta.demoted) return (
                <div key={i} className="text-xs text-white">
                  <span className="text-red-300 font-bold">{name}: Demoted to {reputation}</span>
                </div>
              );
              if (delta.points > 0) return (
                <div key={i} className="text-xs text-white">
                  {name}: <span className="text-green-300 font-bold">+{delta.points} rank pts</span> ({reputation})
                </div>
              );
              if (delta.bufferPoints > 0) return (
                <div key={i} className="text-xs text-white">
                  {name}: <span className="text-red-300 font-bold">−{delta.bufferPoints} buffer pts</span> ({reputation})
                </div>
              );
              return null;
            })}
          </div>
          <button className="ml-auto flex-shrink-0 self-start px-2.5 py-0.5 text-xs bg-white/20 text-white border border-white/40 rounded cursor-pointer hover:bg-white/30" onClick={() => setRankChanges([])}>Dismiss</button>
        </div>
      )}

      {hofInductees.length > 0 && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-start gap-2 border-t border-black/20">
          <div className="flex flex-col gap-1 flex-1">
            <strong>Hall of Fame!</strong>
            {hofInductees.map((inductee, i) => (
              <div key={i} className="text-xs text-white">
                ⭐ {inductee.name} has been inducted into the Hall of Fame! (Score: {inductee.score.toFixed(1)})
              </div>
            ))}
          </div>
          <button className="ml-auto flex-shrink-0 self-start px-2.5 py-0.5 text-xs bg-white/20 text-white border border-white/40 rounded cursor-pointer hover:bg-white/30" onClick={() => setHofInductees([])}>Dismiss</button>
        </div>
      )}
    </div>
  );
```

Also add this import at the top of `TopNav.tsx` (after the existing imports):

```ts
import { Button } from '../ui/button';
```

And remove the line:

```ts
import styles from './TopNav.module.css';
```

- [ ] **Step 2: Delete the CSS Module file**

```bash
rm /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/components/TopNav/TopNav.module.css
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 4: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -10
```

Expected: 421 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/components/TopNav/TopNav.tsx
git rm src/components/TopNav/TopNav.module.css
git commit -m "style: migrate TopNav to Tailwind utilities"
```

---

## Task 5: Migrate Sidebar to Tailwind

**Files:**
- Modify: `src/components/Sidebar/Sidebar.tsx`
- Delete: `src/components/Sidebar/Sidebar.module.css`

- [ ] **Step 1: Read the current Sidebar.tsx**

Read `src/components/Sidebar/Sidebar.tsx` to see the current structure before editing.

- [ ] **Step 2: Replace all className={styles.*} usages with Tailwind**

In `src/components/Sidebar/Sidebar.tsx`:

Remove the import:
```ts
import styles from './Sidebar.module.css';
```

Replace all `styles.*` class references with these Tailwind equivalents:

| CSS Module class | Tailwind replacement |
|---|---|
| `styles.sidebar` | `"overflow-y-auto py-3 bg-zinc-900 border-r border-zinc-700"` + `style={{ gridArea: 'sidebar' }}` |
| `styles.link` | `"block px-4 pl-6 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"` |
| `styles.activeLink` | `"block px-4 pl-5 py-1.5 text-sm text-zinc-100 bg-zinc-800 border-l-[3px] border-orange-500 transition-colors"` |
| `styles.sectionToggle` | `"flex items-center justify-between w-full px-4 pt-2 pb-1 bg-transparent border-none cursor-pointer text-[11px] font-bold uppercase text-zinc-500 tracking-wide hover:text-zinc-400"` |
| `styles.toggleIcon` | `"text-[10px] leading-none"` |
| `styles.infoLink` | `"block px-4 pt-2 pb-1 text-[11px] font-bold uppercase text-zinc-500 tracking-wide hover:text-zinc-400 transition-colors"` |
| `styles.infoLinkActive` | `"block px-4 pt-2 pb-1 text-[11px] font-bold uppercase text-zinc-100 tracking-wide"` |

- [ ] **Step 3: Delete the CSS Module file**

```bash
rm /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/components/Sidebar/Sidebar.module.css
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -10
```

Expected: 421 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/components/Sidebar/Sidebar.tsx
git rm src/components/Sidebar/Sidebar.module.css
git commit -m "style: migrate Sidebar to Tailwind utilities"
```

---

## Task 6: Migrate Roster page to Tailwind + Button/Badge

**Files:**
- Modify: `src/pages/Gym/Roster.tsx`
- Delete: `src/pages/Gym/Roster.module.css`

- [ ] **Step 1: Read Roster.module.css to map all class usages**

Read `src/pages/Gym/Roster.module.css` for the full class list.

- [ ] **Step 2: Update imports in Roster.tsx**

Remove:
```ts
import styles from './Roster.module.css';
```

Add:
```ts
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
```

- [ ] **Step 3: Replace className usages with Tailwind equivalents**

In `src/pages/Gym/Roster.tsx`, apply these replacements:

| CSS Module class | Tailwind replacement |
|---|---|
| `styles.page` | `"mt-4"` |
| `styles.loading` | `"text-zinc-400 italic text-sm p-4"` |
| `styles.empty` | `"text-zinc-500 italic text-sm p-4"` |
| `styles.styleTag` | `"text-zinc-300 font-medium"` |
| `styles.nextFight` | `"text-zinc-300 text-xs"` |
| `styles.noFight` | `"text-zinc-600"` |
| `styles.rankCell` | `"flex flex-col gap-0.5"` |
| `styles.rankLabel` | `"text-[11px] text-zinc-400 whitespace-nowrap"` |
| `styles.rankBarTrack` | `"w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden"` |
| `styles.rankBarFill` | `"h-full bg-blue-500 rounded-full transition-all"` |
| `styles.bufferBarFill` | `"h-full bg-yellow-500 rounded-full transition-all"` |
| `styles.campForm` | `"flex items-center gap-1 mt-1"` |
| `styles.campDateInput` | `"bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-xs text-zinc-200"` |

Replace the `statusBadge` span (which uses an inline `style={{ backgroundColor: status.color }}`) with the `<Badge>` component. Map status colors to Badge variants:
- `var(--danger)` → `variant="danger"`
- `var(--warning)` → `variant="warning"`
- `#2196f3` (blue, scheduled fight) → `variant="muted"` with `className="text-blue-400 border-blue-500"`
- `var(--success)` → `variant="success"`

The `getBoxerStatus` function returns `{ label, color }`. Since we're now using the Badge variant system, update the component's status rendering from:
```tsx
<span className={styles.statusBadge} style={{ backgroundColor: status.color }}>
  {status.label}
</span>
```
to:
```tsx
<Badge variant={status.variant}>{status.label}</Badge>
```

To do this, update the `BoxerStatus` interface and `getBoxerStatus` function in `Roster.tsx` to return `variant` instead of `color`:

```ts
export interface BoxerStatus {
  label: string;
  variant: 'danger' | 'warning' | 'muted' | 'success';
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string,
  boostPct?: number,
): BoxerStatus {
  if (boxer.id === undefined) return { label: 'Active', variant: 'success' };
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, variant: 'danger' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date >= today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    const label = boostPct !== undefined && boostPct > 0
      ? `In Training Camp · +${boostPct}%`
      : 'In Training Camp';
    return { label, variant: 'warning' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', variant: 'muted' };
  }
  return { label: 'Active', variant: 'success' };
}
```

Replace `scheduleBtn` and `campConfirmBtn` with `<Button size="sm">`, and `cancelCampBtn` with `<Button size="sm" variant="outline">`.

- [ ] **Step 4: Check if getBoxerStatus is imported anywhere else that uses `.color`**

```bash
grep -r "getBoxerStatus\|\.color" /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src --include="*.tsx" --include="*.ts" -l
```

If any other file uses `status.color`, update it to `status.variant` to match the new interface.

- [ ] **Step 5: Delete the CSS Module file**

```bash
rm /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/pages/Gym/Roster.module.css
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 7: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -10
```

Expected: All tests passing.

- [ ] **Step 8: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/pages/Gym/Roster.tsx
git rm src/pages/Gym/Roster.module.css
git commit -m "style: migrate Roster page to Tailwind + Button/Badge components"
```

---

## Task 7: Migrate PlayerPage to Tailwind + Badge

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`
- Delete: `src/pages/Player/PlayerPage.module.css`

- [ ] **Step 1: Update imports in PlayerPage.tsx**

Remove:
```ts
import styles from './PlayerPage.module.css';
```

Add:
```ts
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
```

- [ ] **Step 2: Replace all CSS Module class usages**

Apply these Tailwind replacements throughout `PlayerPage.tsx`:

| CSS Module class | Tailwind replacement |
|---|---|
| `styles.page` | `"flex flex-col gap-5"` |
| `styles.header` | `"bg-zinc-900 border border-zinc-700 rounded p-4"` |
| `styles.name` | `"text-xl font-bold text-zinc-100 mb-1.5"` |
| `styles.meta` | `"text-sm text-zinc-400 mb-2.5 [&>span+span]:before:content-['_·_'] [&>span+span]:before:text-zinc-600"` |
| `styles.record` | `"text-sm font-semibold text-zinc-100 mb-2.5"` |
| `styles.tags` | `"flex flex-wrap gap-1.5"` |
| `styles.titleBadge` | Replace `<span className={styles.titleBadge}>` with `<Badge variant="accent">` |
| `styles.talentTag` | Replace `<span className={styles.talentTag}>` with `<Badge variant="warning">` |
| `styles.statsGrid` | `"grid grid-cols-2 gap-3"` |
| `styles.statPanel` | `"bg-zinc-900 border border-zinc-700 rounded overflow-hidden"` |
| `styles.panelTitle` | `"text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-3.5 py-2 bg-zinc-800 border-b border-zinc-700"` |
| `styles.statRow` | `"flex justify-between px-3.5 py-1.5 border-b border-zinc-700 last:border-b-0"` |
| `styles.statName` | `"text-zinc-400 text-xs"` |
| `styles.statValue` | `"font-mono text-xs text-zinc-100 font-semibold"` |
| `styles.section` | `"bg-zinc-900 border border-zinc-700 rounded overflow-hidden"` |
| `styles.sectionTitle` | `"text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-3.5 py-2 bg-zinc-800 border-b border-zinc-700"` |
| `styles.win` | `"text-green-500 font-semibold"` |
| `styles.loss` | `"text-red-500 font-semibold"` |
| `styles.draw` | `"text-zinc-500 font-semibold"` |
| `styles.empty` | `"px-3.5 py-3 text-zinc-500 italic text-xs"` |
| `styles.notFound` | `"text-zinc-400 italic"` |
| `styles.statBarWrapper` | `"flex items-center gap-1.5 min-w-[80px]"` |
| `styles.statBar` | `"relative w-15 h-3.5 bg-red-500 rounded-sm overflow-hidden"` |
| `styles.statBarDim` | `"relative w-15 h-3.5 bg-zinc-700 rounded-sm overflow-hidden"` |
| `styles.statBarFill` | `"absolute left-0 top-0 h-full bg-green-500"` |
| `styles.statBarPct` | `"absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white pointer-events-none [text-shadow:0_0_2px_rgba(0,0,0,0.6)]"` |
| `styles.statBarValue` | `"font-mono text-xs text-zinc-100 font-semibold whitespace-nowrap"` |
| `styles.rankSection` | `"bg-zinc-900 border border-zinc-700 rounded overflow-hidden"` |
| `styles.rankRow` | `"flex justify-between items-center px-3.5 py-2 border-b border-zinc-700 last:border-b-0 text-sm"` |
| `styles.rankRowLabel` | `"text-zinc-400 text-xs min-w-[80px]"` |
| `styles.rankBarContainer` | `"flex-1 mx-3 h-2 bg-zinc-800 rounded border border-zinc-700 overflow-hidden"` |
| `styles.rankBarBlue` | `"h-full bg-blue-500 rounded transition-all duration-200"` |
| `styles.rankBarAmber` | `"h-full bg-yellow-500 rounded transition-all duration-200"` |
| `styles.rankBarNumbers` | `"font-mono text-xs text-zinc-400 whitespace-nowrap"` |
| `styles.rankDeltaPositive` | `"text-green-500 text-xs font-semibold"` |
| `styles.rankDeltaNegative` | `"text-red-500 text-xs font-semibold"` |
| `styles.rankDeltaNeutral` | `"text-zinc-500 text-xs"` |
| `styles.rankPromoted` | `"text-green-500 font-bold text-sm"` |
| `styles.rankDemoted` | `"text-red-500 font-bold text-sm"` |

Also replace any `<button>` elements that use styles (Edit, Export, Retire) with `<Button>` component:
- Edit/Export buttons: `<Button variant="outline" size="sm">`
- Retire button: `<Button variant="danger" size="sm">`

- [ ] **Step 3: Delete the CSS Module file**

```bash
rm /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/pages/Player/PlayerPage.module.css
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 5: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -10
```

Expected: All tests passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
git add src/pages/Player/PlayerPage.tsx
git rm src/pages/Player/PlayerPage.module.css
git commit -m "style: migrate PlayerPage to Tailwind + Badge/Button components"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full build**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 2: Full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework
npm test 2>&1 | tail -15
```

Expected: All 421 tests passing.

- [ ] **Step 3: Confirm no leftover CSS Module imports for migrated files**

```bash
grep -r "TopNav.module.css\|Sidebar.module.css\|Roster.module.css\|PlayerPage.module.css" \
  /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src
```

Expected: No output (all deleted).

- [ ] **Step 4: Confirm no dangling styles.* references in migrated files**

```bash
grep -n "styles\." \
  /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/components/TopNav/TopNav.tsx \
  /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/components/Sidebar/Sidebar.tsx \
  /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/pages/Gym/Roster.tsx \
  /Users/jefsu/Documents/workspace/boxing-manager/.worktrees/styling-rework/src/pages/Player/PlayerPage.tsx \
  2>/dev/null
```

Expected: No output.
