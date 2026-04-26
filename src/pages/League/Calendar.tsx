import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import { getAllFightContracts } from '../../db/fightContractStore';
import { getAllPpvNetworks } from '../../db/ppvNetworkStore';
import type { Boxer, CalendarEvent, Fight, Federation, FederationName, FightContract, PpvNetwork } from '../../db/db';
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
  fightId: number;
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
      fightId: event.fightId,
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
  const [today, setToday] = useState<string>('2026-01-01');
  const [rows, setRows] = useState<CalendarRow[] | null>(null);
  const [boxerMap, setBoxerMap] = useState<Map<number, Boxer>>(new Map());
  const [contractMap, setContractMap] = useState<Map<number, FightContract>>(new Map());
  const [networkMap, setNetworkMap] = useState<Map<number, PpvNetwork>>(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxers, allEvents, allFights, allFederations, allContracts, allNetworks] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
        getAllFightContracts(),
        getAllPpvNetworks(),
      ]);
      if (cancelled) return;
      const gameDate = gym?.currentDate ?? '2026-01-01';
      setToday(gameDate);

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

      const cMap = new Map<number, FightContract>();
      for (const c of allContracts) {
        if (c.fightId !== null) cMap.set(c.fightId, c);
      }
      setContractMap(cMap);

      const nMap = new Map<number, PpvNetwork>();
      for (const n of allNetworks) {
        if (n.id !== undefined) nMap.set(n.id, n);
      }
      setNetworkMap(nMap);

      const derived = deriveRows(allEvents, fMap, gymBoxerIds, fedMap, gameDate);
      setBoxerMap(bMap);
      setRows(derived);
    }

    load();
    window.addEventListener('game:sim', load);
    return () => {
      cancelled = true;
      window.removeEventListener('game:sim', load);
    };
  }, []);

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
                  <td>
                    {(() => {
                      const contract = contractMap.get(row.fightId);
                      if (!contract) return null;
                      if (contract.ppvNetworkId != null) {
                        const network = networkMap.get(contract.ppvNetworkId);
                        return (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            PPV: {network?.name ?? 'Signed'}
                          </span>
                        );
                      }
                      return (
                        <button
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            background: 'none',
                            border: '1px solid var(--accent)',
                            borderRadius: 3,
                            color: 'var(--accent)',
                            cursor: 'pointer',
                          }}
                          onClick={() => navigate(`/league/ppv/${row.fightId}`)}
                        >
                          Sign PPV Deal
                        </button>
                      );
                    })()}
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
