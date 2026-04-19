import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import type { Boxer, CalendarEvent, Fight, Federation, FederationName } from '../../db/db';
import styles from './Calendar.module.css';

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

// --- Types ---

export interface CalendarRow {
  eventId: number;
  date: string;
  gymBoxerId: number;
  opponentId: number | undefined;
  federationAbbr: string;
  isTitleFight: boolean;
}

// --- Exported helpers ---

export function deriveRows(
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  gymBoxerIds: Set<number>,
  federationsMap: Map<number, Federation>,
  today: string
): CalendarRow[] {
  const rows: CalendarRow[] = [];

  for (const event of events) {
    if (event.type !== 'fight') continue;
    if (event.date < today) continue;

    const gymBoxerId = event.boxerIds.find(id => gymBoxerIds.has(id));
    if (gymBoxerId === undefined) continue;

    const fight = fightsMap.get(event.fightId);
    if (!fight) continue;

    if (event.id === undefined) continue;
    const opponentId = fight.boxerIds.find(id => id !== gymBoxerId);

    const federation = federationsMap.get(fight.federationId);
    const federationAbbr = federation
      ? (FEDERATION_ABBR[federation.name] ?? federation.name)
      : '?';

    rows.push({
      eventId: event.id,
      date: event.date,
      gymBoxerId,
      opponentId,
      federationAbbr,
      isTitleFight: fight.isTitleFight,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

export default function Calendar() {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<CalendarRow[] | null>(null);
  const [boxerMap, setBoxerMap] = useState<Map<number, Boxer>>(new Map());

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getGym(),
      getAllBoxers(),
      getAllCalendarEvents(),
      getAllFights(),
      getAllFederations(),
    ]).then(([gym, allBoxers, allEvents, allFights, allFederations]) => {
      if (cancelled) return;

      const gymId = gym?.id;
      const gymBoxerIds = new Set<number>(
        allBoxers
          .filter(b => b.gymId === gymId && b.id !== undefined)
          .map(b => b.id!)
      );

      const bMap = new Map<number, Boxer>();
      for (const boxer of allBoxers) {
        if (boxer.id !== undefined) bMap.set(boxer.id, boxer);
      }

      const fMap = new Map<number, Fight>();
      for (const fight of allFights) {
        if (fight.id !== undefined) fMap.set(fight.id, fight);
      }

      const fedMap = new Map<number, Federation>();
      for (const fed of allFederations) {
        if (fed.id !== undefined) fedMap.set(fed.id, fed);
      }

      const derived = deriveRows(allEvents, fMap, gymBoxerIds, fedMap, today);
      setBoxerMap(bMap);
      setRows(derived);
    });

    return () => {
      cancelled = true;
    };
  }, [today]);

  if (rows === null) {
    return (
      <div className={styles.page}>
        <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
      {rows.length === 0 ? (
        <p className={styles.empty}>No upcoming fights scheduled.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Boxer</th>
              <th>Opponent</th>
              <th>Federation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const gymBoxer = boxerMap.get(row.gymBoxerId);
              const opponent = row.opponentId !== undefined
                ? boxerMap.get(row.opponentId)
                : undefined;

              return (
                <tr key={row.eventId}>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    {gymBoxer !== undefined
                      ? <Link to={'/player/' + gymBoxer.id}>{gymBoxer.name}</Link>
                      : '—'}
                  </td>
                  <td>
                    {opponent !== undefined
                      ? <Link to={'/player/' + opponent.id}>{opponent.name}</Link>
                      : row.opponentId !== undefined
                        ? 'Unknown'
                        : '—'}
                  </td>
                  <td>{row.federationAbbr}</td>
                  <td>
                    {row.isTitleFight && (
                      <span className={styles.titleBadge}>Title Fight</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
