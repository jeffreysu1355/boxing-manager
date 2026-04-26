import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, getAllBoxers } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { STYLE_STATS } from '../../lib/training';
import type { Boxer, BoxerStats, Coach, FightRecord } from '../../db/db';
import styles from './PlayerPage.module.css';

// --- Stat group definitions ---

const STAT_GROUPS: { label: string; stats: (keyof BoxerStats)[] }[] = [
  {
    label: 'Offense',
    stats: ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'],
  },
  {
    label: 'Defense',
    stats: ['headMovement', 'bodyMovement', 'guard', 'positioning'],
  },
  {
    label: 'Mental',
    stats: ['timing', 'adaptability', 'discipline'],
  },
  {
    label: 'Physical',
    stats: ['speed', 'power', 'endurance', 'recovery', 'toughness'],
  },
];

const STAT_LABELS: Record<keyof BoxerStats, string> = {
  jab: 'Jab',
  cross: 'Cross',
  leadHook: 'Lead Hook',
  rearHook: 'Rear Hook',
  uppercut: 'Uppercut',
  headMovement: 'Head Movement',
  bodyMovement: 'Body Movement',
  guard: 'Guard',
  positioning: 'Positioning',
  timing: 'Timing',
  adaptability: 'Adaptability',
  discipline: 'Discipline',
  speed: 'Speed',
  power: 'Power',
  endurance: 'Endurance',
  recovery: 'Recovery',
  toughness: 'Toughness',
};

// --- Helpers ---

function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

function styleLabel(style: Boxer['style']): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Component ---

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [boxer, setBoxer] = useState<Boxer | null | undefined>(undefined);
  const [opponentIndex, setOpponentIndex] = useState<Map<string, number>>(new Map());
  const [coach, setCoach] = useState<Coach | null | undefined>(undefined);

  useEffect(() => {
    if (!id) { setBoxer(null); setCoach(null); return; }
    let cancelled = false;
    Promise.all([getBoxer(Number(id)), getAllBoxers(), getAllCoaches()]).then(([b, all, coaches]) => {
      if (cancelled) return;
      setBoxer(b ?? null);
      const index = new Map<string, number>();
      for (const boxer of all) {
        if (boxer.id !== undefined) index.set(boxer.name, boxer.id);
      }
      setOpponentIndex(index);
      const assignedCoach = coaches.find(c => c.assignedBoxerId === Number(id)) ?? null;
      setCoach(assignedCoach);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (boxer === undefined) {
    return (
      <div>
        <PageHeader title="Player" subtitle="" />
        <p className={styles.notFound}>Loading…</p>
      </div>
    );
  }

  if (boxer === null) {
    return (
      <div>
        <PageHeader title="Player" subtitle="" />
        <p className={styles.notFound}>Boxer not found.</p>
      </div>
    );
  }

  const activeTitles = boxer.titles.filter(t => t.dateLost === null);
  const trainedStats = new Set<keyof BoxerStats>(
    coach ? STYLE_STATS[coach.style] : []
  );
  const sortedRecord = [...boxer.record].reverse();

  return (
    <div>
      <PageHeader title={boxer.name} subtitle={boxer.reputation} />
      <div className={styles.page}>

        {/* Header card */}
        <div className={styles.header}>
          <div className={styles.meta}>
            <span>{boxer.age} yrs</span>
            <span>{capitalize(boxer.weightClass)}</span>
            <span>{styleLabel(boxer.style)}</span>
          </div>
          <div className={styles.record}>{calcRecord(boxer.record)} ({boxer.record.length} fights)</div>
          {(activeTitles.length > 0 || boxer.naturalTalents.length > 0) && (
            <div className={styles.tags}>
              {activeTitles.map(t => (
                <span key={t.titleId} className={styles.titleBadge}>Champion</span>
              ))}
              {boxer.naturalTalents.map((t, i) => (
                <span key={i} className={styles.talentTag}>
                  Super {STAT_LABELS[t.stat]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          {STAT_GROUPS.map(group => (
            <div key={group.label} className={styles.statPanel}>
              <div className={styles.panelTitle}>{group.label}</div>
              {group.stats.map(stat => {
                const isTrained = trainedStats.has(stat);
                const currentExp = boxer.trainingExp?.[stat] ?? 0;
                const threshold = boxer.stats[stat] * 10;
                const pct = threshold > 0 ? Math.min(100, (currentExp / threshold) * 100) : 0;
                return (
                  <div key={stat} className={styles.statRow}>
                    <span className={styles.statName}>{STAT_LABELS[stat]}</span>
                    {isTrained ? (
                      <div className={styles.statBarWrapper}>
                        <div className={styles.statBar}>
                          <div className={styles.statBarFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.statBarValue}>{boxer.stats[stat]}</span>
                      </div>
                    ) : (
                      <span className={styles.statValue}>{boxer.stats[stat]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Fight record */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Fight Record</div>
          {sortedRecord.length === 0 ? (
            <p className={styles.empty}>No professional fights.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Opponent</th>
                  <th>Method</th>
                  <th>Round</th>
                  <th>Time</th>
                  <th>Federation</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecord.map((fight, i) => (
                  <tr key={i}>
                    <td className={
                      fight.result === 'win' ? styles.win :
                      fight.result === 'loss' ? styles.loss :
                      styles.draw
                    }>
                      {capitalize(fight.result)}
                    </td>
                    <td>
                      {opponentIndex.has(fight.opponentName)
                        ? <Link to={`/player/${opponentIndex.get(fight.opponentName)}`}>{fight.opponentName}</Link>
                        : fight.opponentName}
                    </td>
                    <td>
                      {fight.method}
                      {fight.finishingMove ? ` (${fight.finishingMove})` : ''}
                    </td>
                    <td>{fight.round}</td>
                    <td>{fight.time}</td>
                    <td>{fight.federation}</td>
                    <td>{fight.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
