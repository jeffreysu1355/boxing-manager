import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router';

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
      { to: '/league/hall-of-fame', label: 'Hall of Fame' },
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
      { to: '/gym/retired', label: 'Retired' },
    ],
  },
  {
    label: 'Players',
    prefix: '/players',
    links: [
      { to: '/players/recruiting', label: 'Recruiting' },
      { to: '/players/coaches', label: 'Coaches' },
      { to: '/players/compare', label: 'Compare' },
      { to: '/players/watchlist', label: 'Watchlist' },
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
    Object.fromEntries(allSections.map(s => [s.label, false]))
  );

  useEffect(() => {
    setCollapsed(prev => {
      const activeSection = allSections.find(s => s.prefix === activePrefix);
      if (!activeSection || !prev[activeSection.label]) return prev;
      return { ...prev, [activeSection.label]: false };
    });
  }, [activePrefix]);

  function toggleSection(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside className="overflow-y-auto py-3 bg-zinc-900 border-r border-zinc-700" style={{ gridArea: 'sidebar' }}>
      {allSections.map((section) => (
        <div key={section.label}>
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 pt-2 pb-1 bg-transparent border-none cursor-pointer text-[11px] font-bold uppercase text-zinc-500 tracking-wide hover:text-zinc-400"
            onClick={() => toggleSection(section.label)}
          >
            {section.label}
            <span className="text-[10px] leading-none">
              {collapsed[section.label] ? '▸' : '▾'}
            </span>
          </button>
          {!collapsed[section.label] && section.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive
                  ? "block px-4 pl-5 py-2 text-sm text-zinc-100 bg-zinc-800 border-l-[3px] border-orange-500 transition-colors"
                  : "block px-4 pl-6 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
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
          isActive
            ? "block px-4 pt-2 pb-1 text-[11px] font-bold uppercase text-zinc-100 tracking-wide"
            : "block px-4 pt-2 pb-1 text-[11px] font-bold uppercase text-zinc-500 tracking-wide hover:text-zinc-400 transition-colors"
        }
      >
        Info
      </NavLink>
    </aside>
  );
}
