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
        { to: '/league/schedule', label: 'Schedule' },
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
