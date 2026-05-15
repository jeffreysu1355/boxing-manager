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
            type="button"
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
