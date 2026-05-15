# Sidebar All-Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the context-filtered sidebar with a full sidebar showing all top-level sections as collapsible groups, auto-expanding the active section on load.

**Architecture:** The `Sidebar` component switches from a pathname-filtered config lookup to a static full nav config. Local React state tracks which sections are collapsed. Info is a direct nav link with no sub-pages. All other files stay untouched.

**Tech Stack:** React 18, TypeScript, CSS Modules, React Router v7

---

### Task 1: Update `Sidebar.tsx` — full static config + collapsible state

**Files:**
- Modify: `src/components/Sidebar/Sidebar.tsx`

This task replaces the entire component. The new version:
- Defines a static `allSections` array (all sections always shown)
- Derives initial collapsed state from the current pathname (active prefix = expanded)
- Renders each section as a toggle button + conditionally rendered links
- Renders Info as a standalone `NavLink`

- [ ] **Step 1: Replace `Sidebar.tsx` with the new implementation**

```tsx
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import styles from './Sidebar.module.css';

interface SidebarSection {
  label: string;
  prefix: string;
  links: { to: string; label: string }[];
}

const allSections: SidebarSection[] = [
  {
    label: 'League',
    prefix: '/league',
    links: [
      { to: '/league/standings', label: 'Standings' },
      { to: '/league/calendar', label: 'Calendar' },
      { to: '/league/results', label: 'Results' },
      { to: '/league/championship-history', label: 'Championship History' },
      { to: '/league/schedule', label: 'Schedule' },
    ],
  },
  {
    label: 'Gym',
    prefix: '/gym',
    links: [
      { to: '/gym/roster', label: 'Roster' },
      { to: '/gym/finances', label: 'Finances' },
      { to: '/gym/coaches', label: 'Coaches' },
    ],
  },
  {
    label: 'Players',
    prefix: '/players',
    links: [
      { to: '/players/recruiting', label: 'Recruiting' },
      { to: '/players/coaches', label: 'Coaches' },
      { to: '/players/compare', label: 'Compare' },
    ],
  },
  {
    label: 'Tools',
    prefix: '/tools',
    links: [
      { to: '/tools/god-mode', label: 'God Mode' },
    ],
  },
];

function getActivePrefix(pathname: string): string {
  return '/' + pathname.split('/')[1];
}

export function Sidebar() {
  const { pathname } = useLocation();
  const activePrefix = getActivePrefix(pathname);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allSections.map(s => [s.label, s.prefix !== activePrefix]))
  );

  function toggleSection(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside className={styles.sidebar}>
      {allSections.map((section) => (
        <div key={section.label}>
          <button
            className={styles.sectionToggle}
            onClick={() => toggleSection(section.label)}
          >
            {section.label}
            <span className={styles.toggleIcon}>
              {collapsed[section.label] ? '▸' : '▾'}
            </span>
          </button>
          {!collapsed[section.label] && section.links.map((link) => (
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
      <NavLink
        to="/info"
        className={({ isActive }) =>
          isActive ? styles.infoLinkActive : styles.infoLink
        }
      >
        Info
      </NavLink>
    </aside>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

---

### Task 2: Update `Sidebar.module.css` — section toggle button styles

**Files:**
- Modify: `src/components/Sidebar/Sidebar.module.css`

Add styles for the new `sectionToggle`, `toggleIcon`, `infoLink`, and `infoLinkActive` class names used in Task 1. Existing `.sectionLabel`, `.link`, and `.activeLink` remain unchanged.

- [ ] **Step 1: Add new styles to `Sidebar.module.css`**

Append to the end of the existing file:

```css
.sectionToggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 16px 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-align: left;
}

.sectionToggle:hover {
  color: var(--text-secondary);
}

.toggleIcon {
  font-size: 10px;
  line-height: 1;
}

.infoLink {
  display: block;
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  transition: color 0.15s;
}

.infoLink:hover {
  color: var(--text-secondary);
}

.infoLinkActive {
  composes: infoLink;
  color: var(--text-primary);
}
```

- [ ] **Step 2: Verify build still passes**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/Sidebar.tsx src/components/Sidebar/Sidebar.module.css
git commit -m "feat: expand sidebar to show all sections with collapsible groups"
```

---

### Self-Review Notes

**Spec coverage:**
- ✅ All sections always present (League, Gym, Players, Tools, Info)
- ✅ Section headers toggle expand/collapse
- ✅ Active section auto-expanded on load
- ✅ Info is a direct NavLink, not a collapsible group
- ✅ Active sub-link styling unchanged (existing `.activeLink` class reused)
- ✅ Top nav untouched

**Placeholder scan:** None found.

**Type consistency:** `SidebarSection` interface defined once in Task 1 and used only there. `collapsed` state is `Record<string, boolean>` throughout.
