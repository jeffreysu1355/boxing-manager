import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { getTitle } from '../../db/titleStore';
import { getFederation } from '../../db/federationStore';
import { STYLE_STATS } from '../../lib/training';
import type { Boxer, BoxerStats, Coach, FightRecord, Federation } from '../../db/db';
import styles from './PlayerPage.module.css';

const FEDERATION_ABBR: Record<string, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation': 'ABF',
  'European Boxing Federation': 'EBF',
  'Asia Boxing Federation': 'AsBF',
  'Oceania Boxing Federation': 'OBF',
  'International Boxing Federation': 'IBF',
};

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

function formatFightDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Component ---

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [boxer, setBoxer] = useState<Boxer | null | undefined>(undefined);
  const [coach, setCoach] = useState<Coach | null | undefined>(undefined);
  const [titleFedMap, setTitleFedMap] = useState<Map<number, { abbr: string; weightClass: string }>>(new Map());

  useEffect(() => {
    if (!id) { setBoxer(null); setCoach(null); return; }
    let cancelled = false;

    async function load() {
      const [b, coaches] = await Promise.all([getBoxer(Number(id)), getAllCoaches()]);
      if (cancelled) return;
      setBoxer(b ?? null);
      setCoach(coaches.find(c => c.assignedBoxerId === Number(id)) ?? null);

      if (b && b.titles.length > 0) {
        const titleObjs = await Promise.all(b.titles.map(t => getTitle(t.titleId)));
        const fedIds = [...new Set(titleObjs.filter(Boolean).map(t => t!.federationId))];
        const feds = await Promise.all(fedIds.map(fid => getFederation(fid)));
        const fedById = new Map<number, Federation>();
        for (const fed of feds) {
          if (fed?.id !== undefined) fedById.set(fed.id, fed);
        }
        const map = new Map<number, { abbr: string; weightClass: string }>();
        for (const [i, titleObj] of titleObjs.entries()) {
          if (!titleObj) continue;
          const fed = fedById.get(titleObj.federationId);
          const abbr = fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : '?';
          map.set(b.titles[i].titleId, { abbr, weightClass: titleObj.weightClass });
        }
        if (!cancelled) setTitleFedMap(map);
      }
    }

    load();

    window.addEventListener('game:sim', load);
    return () => {
      cancelled = true;
      window.removeEventListener('game:sim', load);
    };
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
  const sortedRecord = [...boxer.record].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
              {activeTitles.map(t => {
                const info = titleFedMap.get(t.titleId);
                const label = info
                  ? `${info.abbr} ${capitalize(info.weightClass)} Champion`
                  : 'Champion';
                return <span key={t.titleId} className={styles.titleBadge}>{label}</span>;
              })}
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
                          <span className={styles.statBarPct}>{Math.round(pct)}%</span>
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
                  <th></th>
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
                      {fight.opponentId != null
                        ? <Link to={`/player/${fight.opponentId}`}>{fight.opponentName}</Link>
                        : fight.opponentName}
                    </td>
                    <td>
                      {fight.method}
                      {fight.finishingMove ? ` (${fight.finishingMove})` : ''}
                    </td>
                    <td>{fight.round}</td>
                    <td>{fight.time}</td>
                    <td>{fight.federation}</td>
                    <td>{formatFightDate(fight.date)}</td>
                    <td>
                      {fight.isTitleFight && (
                        <span className={styles.titleBadge}>Title Fight</span>
                      )}
                    </td>
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
