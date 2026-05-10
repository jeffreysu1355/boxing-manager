import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { getFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import type { Fight, Boxer } from '../../db/db';
import styles from './FightResultsPage.module.css';

interface FightEntry {
  fight: Fight;
  boxers: Map<number, Boxer>;
}

function resultLine(fight: Fight, boxers: Map<number, Boxer>): string {
  const boxerName = (id: number | undefined) =>
    id !== undefined ? (boxers.get(id)?.name ?? `Boxer #${id}`) : '—';

  if (fight.method === 'Draw') return `Draw — ${fight.method}`;
  if (fight.winnerId === null) return 'Result pending';

  const winnerName = boxerName(fight.winnerId);
  const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
  if (isDecision) return `${winnerName} wins by ${fight.method}`;

  const move = fight.finishingMove ? ` (${fight.finishingMove})` : '';
  const timing = fight.round != null ? ` — Rd. ${fight.round}` : '';
  const time = fight.time ? ` (${fight.time})` : '';
  return `${winnerName} wins by ${fight.method}${move}${timing}${time}`;
}

function resultDetail(fight: Fight): string | null {
  const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
  const isDraw = fight.method === 'Draw';
  if (isDecision || isDraw || fight.winnerId === null) return null;

  const parts: string[] = [fight.method];
  if (fight.finishingMove) parts.push(fight.finishingMove);
  if (fight.round != null) parts.push(`Round ${fight.round}`);
  if (fight.time) parts.push(fight.time);
  return parts.join(' · ');
}

export default function FightResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (searchParams.get('fights') ?? '')
      .split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    async function load() {
      const results: FightEntry[] = [];
      for (const id of ids) {
        const fight = await getFight(id);
        if (!fight) continue;
        const boxerEntries = await Promise.all(
          fight.boxerIds.map(async bid => {
            const b = await getBoxer(bid);
            return b ? ([bid, b] as [number, Boxer]) : null;
          })
        );
        const map = new Map<number, Boxer>();
        for (const entry of boxerEntries) {
          if (entry) map.set(entry[0], entry[1]);
        }
        results.push({ fight, boxers: map });
      }
      setEntries(results);
      setLoading(false);
    }

    load();
  }, [searchParams]);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        &larr; Back
      </button>
      <h2 className={styles.title}>Fight Results</h2>
      <p className={styles.subtitle}>
        {entries.length > 0 ? entries[0].fight.date : '—'}
      </p>

      {loading && <p className={styles.empty}>Loading…</p>}

      {!loading && entries.length === 0 && (
        <p className={styles.empty}>No fight results found.</p>
      )}

      {entries.map(({ fight, boxers }) => {
        const [b1Id, b2Id] = fight.boxerIds;
        const b1 = boxers.get(b1Id);
        const b2 = b2Id !== undefined ? boxers.get(b2Id) : undefined;
        const name = (id: number | undefined, b: Boxer | undefined) =>
          b?.name ?? (id !== undefined ? `Boxer #${id}` : '—');
        const detail = resultDetail(fight);

        return (
          <div key={fight.id} className={styles.card}>
            <div className={styles.cardHeader}>
              {name(b1Id, b1)} vs. {name(b2Id, b2)}
            </div>
            <div className={styles.cardMeta}>
              {fight.isTitleFight && (
                <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 8 }}>
                  Title Fight ·
                </span>
              )}
              <Link
                to={`/fight/${fight.id}`}
                style={{ color: 'var(--text-secondary)', fontSize: 12 }}
              >
                View Details →
              </Link>
            </div>
            <div className={styles.resultLabel}>Result</div>
            <div className={styles.resultLine}>{resultLine(fight, boxers)}</div>
            {detail && <div className={styles.resultDetail}>{detail}</div>}
            <div className={styles.boxerLinks}>
              {b1 && b1.id !== undefined && (
                <Link to={`/player/${b1.id}`} className={styles.boxerLink}>{b1.name}</Link>
              )}
              {b2 && b2.id !== undefined && (
                <Link to={`/player/${b2.id}`} className={styles.boxerLink}>{b2.name}</Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
