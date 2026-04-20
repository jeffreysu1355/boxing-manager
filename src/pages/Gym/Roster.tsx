import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord, FederationName } from '../../db/db';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import styles from './Roster.module.css';

// --- Constants ---

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Exported helpers ---

export interface BoxerStatus {
  label: string;
  color: string;
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string
): BoxerStatus {
  if (boxer.id === undefined) return { label: 'Active', color: 'var(--success)' };
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id) && e.date >= today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    return { label: 'In Training Camp', color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  if (boxer.id === undefined) return null;
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id) && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (boxersMap.get(opponentId)?.name ?? 'Unknown')
    : 'Unknown';

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? (FEDERATION_ABBR[federation.name] ?? federation.name) : '?';
  const [year, month, day] = soonest.date.split('-').map(Number);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} vs. ${opponentName} (${abbr})`;
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function styleLabel(style: string): string {
  return style.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Component ---

export default function Roster() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fightsMap, setFightsMap] = useState<Map<number, Fight>>(new Map());
  const [federationsMap, setFederationsMap] = useState<Map<number, Federation>>(new Map());
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxers, allEvents, allFights, allFederations] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
      ]);

      if (cancelled) return;

      const gymId = gym?.id ?? 1;
      const gymRoster = allBoxers.filter(b => b.gymId === gymId);

      const bMap = new Map<number, Boxer>();
      for (const b of allBoxers) {
        if (b.id !== undefined) bMap.set(b.id, b);
      }

      const fMap = new Map<number, Fight>();
      for (const f of allFights) {
        if (f.id !== undefined) fMap.set(f.id, f);
      }

      const fedMap = new Map<number, Federation>();
      for (const fed of allFederations) {
        if (fed.id !== undefined) fedMap.set(fed.id, fed);
      }

      setRoster(gymRoster);
      setEvents(allEvents);
      setFightsMap(fMap);
      setFederationsMap(fedMap);
      setBoxersMap(bMap);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Roster" subtitle="Current gym members" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <div className={styles.page}>
        {roster.length === 0 ? (
          <p className={styles.empty}>No boxers on your roster yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Weight Class</th>
                <th>Style</th>
                <th>Record</th>
                <th>Status</th>
                <th>Next Fight</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roster.map(boxer => {
                const status = getBoxerStatus(boxer, events, today);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                return (
                  <tr key={boxer.id}>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{boxer.age}</td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {nextFight
                        ? <span className={styles.nextFight}>{nextFight}</span>
                        : <span className={styles.noFight}>—</span>
                      }
                    </td>
                    <td>
                      {status.label !== 'Scheduled Fight' && !boxer.injuries.some(i => i.recoveryDays > 0) && (
                        <button
                          className={styles.scheduleBtn}
                          onClick={() => navigate(`/league/schedule?boxerId=${boxer.id}`)}
                        >
                          Schedule Fight
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
