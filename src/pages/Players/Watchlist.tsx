import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { WatchlistFlag } from '../../components/WatchlistFlag/WatchlistFlag';
import { getGym, removeFromWatchlist } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  capitalize,
} from '../Gym/Roster';
import { RANK_CONFIG } from '../../lib/rankSystem';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';
import styles from './Watchlist.module.css';
import rosterStyles from '../Gym/Roster.module.css';

function RankMiniBar({ boxer }: { boxer: Boxer }) {
  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;
  const progressPct = config.promotionThreshold === Infinity
    ? 100
    : Math.min(100, (rankPoints / config.promotionThreshold) * 100);
  const bufferPct = Math.min(100, (demotionBuffer / config.bufferMax) * 100);
  const tooltip = config.promotionThreshold === Infinity
    ? `${boxer.reputation} · Buffer: ${demotionBuffer} / ${config.bufferMax}`
    : `${rankPoints} / ${config.promotionThreshold} pts to next rank · Buffer: ${demotionBuffer} / ${config.bufferMax}`;

  return (
    <div className={rosterStyles.rankCell} title={tooltip}>
      <span className={rosterStyles.rankLabel}>{boxer.reputation}</span>
      <div className={rosterStyles.rankBarTrack}>
        <div className={rosterStyles.rankBarFill} style={{ width: `${progressPct}%` }} />
      </div>
      <div className={rosterStyles.rankBarTrack}>
        <div className={rosterStyles.bufferBarFill} style={{ width: `${bufferPct}%` }} />
      </div>
    </div>
  );
}

const WEIGHT_ORDER = ['flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight'];

export default function Watchlist() {
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [gymId, setGymId] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fightsMap, setFightsMap] = useState<Map<number, Fight>>(new Map());
  const [federationsMap, setFederationsMap] = useState<Map<number, Federation>>(new Map());
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);

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

      const ids = gym?.watchlistIds ?? [];
      const watched = allBoxers
        .filter(b => b.id !== undefined && ids.includes(b.id))
        .sort((a, b) => {
          const wi = WEIGHT_ORDER.indexOf(a.weightClass) - WEIGHT_ORDER.indexOf(b.weightClass);
          return wi !== 0 ? wi : a.name.localeCompare(b.name);
        });

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

      setGymId(gym?.id ?? null);
      setBoxers(watched);
      setEvents(allEvents);
      setFightsMap(fMap);
      setFederationsMap(fedMap);
      setBoxersMap(bMap);
      setToday(gym?.currentDate ?? '');
      setLoading(false);
    }

    load();
    window.addEventListener('game:sim', load);
    return () => {
      cancelled = true;
      window.removeEventListener('game:sim', load);
    };
  }, []);

  async function handleRemove(boxerId: number) {
    await removeFromWatchlist(boxerId);
    setBoxers(prev => prev.filter(b => b.id !== boxerId));
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Watchlist" subtitle="Boxers you're tracking" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Watchlist" subtitle="Boxers you're tracking" />
      <div className={styles.page}>
        {boxers.length === 0 ? (
          <p className={styles.empty}>No boxers on your watchlist yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className={styles.flagCell}></th>
                <th>Name</th>
                <th>Weight Class</th>
                <th>Record</th>
                <th>Reputation</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Next Fight</th>
              </tr>
            </thead>
            <tbody>
              {boxers.map(boxer => {
                const status = getBoxerStatus(boxer, events, today);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                const isOwnGym = boxer.gymId === gymId && gymId !== null;

                return (
                  <tr key={boxer.id}>
                    <td className={styles.flagCell}>
                      <WatchlistFlag
                        isWatchlisted={true}
                        isOwnGym={isOwnGym}
                        onToggle={() => handleRemove(boxer.id!)}
                      />
                    </td>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td>{boxer.reputation}</td>
                    <td><RankMiniBar boxer={boxer} /></td>
                    <td>
                      <span
                        className={rosterStyles.statusBadge}
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {nextFight
                        ? <span className={rosterStyles.nextFight}>{nextFight}</span>
                        : <span className={rosterStyles.noFight}>—</span>
                      }
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
