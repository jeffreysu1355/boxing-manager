import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers } from '../../db/boxerStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import type { CalendarEvent, Gym } from '../../db/db';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/league', label: 'League' },
  { to: '/gym', label: 'Gym' },
  { to: '/players', label: 'Players' },
  { to: '/tools', label: 'Tools' },
];

function formatGameDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TopNav() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gymBoxerIds, setGymBoxerIds] = useState<Set<number>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fightStop, setFightStop] = useState<CalendarEvent | null>(null);
  const [isSimming, setIsSimming] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getGym(), getAllCalendarEvents(), getAllBoxers()]).then(
      ([g, evts, boxers]) => {
        setGym(g ?? null);
        setEvents(evts);
        const gymId = g?.id ?? 1;
        const ids = new Set(
          boxers
            .filter(b => b.gymId === gymId && b.id !== undefined)
            .map(b => b.id!)
        );
        setGymBoxerIds(ids);
      }
    );
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSim(days: number | 'next') {
    if (!gym || isSimming) return;
    setIsSimming(true);
    setFightStop(null);  // clear stale banner before new sim
    setDropdownOpen(false);

    try {
      const currentDate = gym.currentDate ?? '2026-01-01';
      let result;

      if (days === 'next') {
        const nextDate = nextEventDate(currentDate, events, gymBoxerIds);
        const target = nextDate ?? addDays(currentDate, 7);
        const fightAtTarget = nextDate
          ? events.find(
              e => e.date === nextDate && e.boxerIds.some(id => gymBoxerIds.has(id))
            ) ?? null
          : null;
        result = { newDate: target, stoppedAt: fightAtTarget };
      } else {
        result = simForward(currentDate, days, events, gymBoxerIds);
      }

      const updated: Gym = { ...gym, currentDate: result.newDate };
      await saveGym(updated);
      setGym(updated);
      setFightStop(result.stoppedAt);

      // Re-fetch events so newly scheduled fights are visible to future sims
      const [freshEvts, freshBoxers] = await Promise.all([
        getAllCalendarEvents(),
        getAllBoxers(),
      ]);
      setEvents(freshEvts);
      const freshGymId = updated.id ?? 1;
      const freshIds = new Set(
        freshBoxers
          .filter(b => b.gymId === freshGymId && b.id !== undefined)
          .map(b => b.id!)
      );
      setGymBoxerIds(freshIds);
    } finally {
      setIsSimming(false);
    }
  }

  const currentDate = gym?.currentDate ?? '2026-01-01';
  const todayFightEvents = events.filter(
    e => e.type === 'fight' && e.date === currentDate && e.boxerIds.some(id => gymBoxerIds.has(id))
  );
  const isOnFightDay = todayFightEvents.length > 0;

  function handlePlayFight() {
    if (todayFightEvents.length === 0) return;
    setDropdownOpen(false);
    navigate(`/fight/${todayFightEvents[0].fightId}`);
  }

  async function handleSimFight() {
    if (!gym || isSimming) return;
    setIsSimming(true);
    setDropdownOpen(false);
    try {
      const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
      await saveGym(updated);
      setGym(updated);
      setFightStop(null);
      const [freshEvts, freshBoxers] = await Promise.all([
        getAllCalendarEvents(),
        getAllBoxers(),
      ]);
      setEvents(freshEvts);
      const freshGymId = updated.id ?? 1;
      const freshIds = new Set(
        freshBoxers
          .filter(b => b.gymId === freshGymId && b.id !== undefined)
          .map(b => b.id!)
      );
      setGymBoxerIds(freshIds);
    } finally {
      setIsSimming(false);
    }
  }

  return (
    <div className={styles.topNavWrapper}>
      <nav className={styles.topNav}>
        <span className={styles.brand}>Boxing Manager</span>

        <div className={styles.playArea} ref={dropdownRef}>
          <span className={styles.dateDisplay}>{formatGameDate(currentDate)}</span>
          <button
            className={styles.playBtn}
            onClick={() => setDropdownOpen(o => !o)}
            disabled={isSimming}
          >
            {isSimming ? 'Simming...' : 'Play ▾'}
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              {isOnFightDay ? (
                <>
                  <button className={styles.dropdownItem} onClick={handlePlayFight}>
                    Play Fight
                  </button>
                  <button className={styles.dropdownItem} onClick={handleSimFight}>
                    Sim Fight
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.dropdownItem} onClick={() => handleSim(7)}>
                    Sim 1 Week
                  </button>
                  <button className={styles.dropdownItem} onClick={() => handleSim(21)}>
                    Sim 1 Month
                  </button>
                  <button className={styles.dropdownItem} onClick={() => handleSim('next')}>
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
              isActive ? styles.activeTab : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {fightStop && (
        <div className={styles.fightBanner}>
          <strong>Fight Day!</strong> A scheduled fight has arrived on{' '}
          {formatGameDate(fightStop.date)}.{' '}
          <button
            className={styles.dismissBtn}
            onClick={() => setFightStop(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
