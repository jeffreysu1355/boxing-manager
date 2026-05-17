import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { getGym, addToWatchlist, removeFromWatchlist } from '../../db/gymStore';
import { WatchlistFlag } from '../../components/WatchlistFlag/WatchlistFlag';
import { getAllTitles, getTitle } from '../../db/titleStore';
import { getFederation } from '../../db/federationStore';
import { retireBoxer } from '../../lib/retireBoxer';
import { exportBoxer } from '../../lib/exportBoxer';
import { getHofEntryByBoxer } from '../../db/hallOfFameStore';
import { STYLE_STATS } from '../../lib/training';
import { RANK_CONFIG } from '../../lib/rankSystem';
import type { Boxer, BoxerStats, Coach, FightRecord, Federation } from '../../db/db';
import { FEDERATION_ABBR } from '../../constants/federations';
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

function formatFightDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatBirthDate(birthDate: string | undefined): string {
  if (!birthDate) return '—';
  const [year, month, day] = birthDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

function RankingSection({ boxer }: { boxer: Boxer }) {
  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;
  const delta = boxer.lastRankDelta;

  const progressPct = config.promotionThreshold === Infinity
    ? 100
    : Math.min(100, (rankPoints / config.promotionThreshold) * 100);
  const bufferPct = Math.min(100, (demotionBuffer / config.bufferMax) * 100);

  const progressLabel = config.promotionThreshold === Infinity
    ? `${rankPoints} pts (max rank)`
    : `${rankPoints} / ${config.promotionThreshold} pts`;

  function renderDelta() {
    if (!delta) return null;
    if (delta.promoted) return <span className={styles.rankPromoted}>Promoted to {boxer.reputation}!</span>;
    if (delta.demoted) return <span className={styles.rankDemoted}>Demoted to {boxer.reputation}</span>;
    if (delta.points === 0 && delta.bufferPoints === 0) return <span className={styles.rankDeltaNeutral}>No rank change (title fight loss)</span>;
    if (delta.bufferPoints > 0) return <span className={styles.rankDeltaNegative}>−{delta.bufferPoints} buffer pts</span>;
    if (delta.points > 0 && !delta.promoted) return <span className={styles.rankDeltaPositive}>+{delta.points} pts</span>;
    if (delta.points > 0 && delta.demoted) return <span className={styles.rankDeltaNegative}>−{delta.points} pts</span>;
    return null;
  }

  return (
    <div className={styles.rankSection}>
      <div className={styles.sectionTitle}>Ranking</div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Rank</span>
        <span style={{ flex: 1 }}>{boxer.reputation}</span>
      </div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Progress</span>
        <div className={styles.rankBarContainer}>
          <div className={styles.rankBarBlue} style={{ width: `${progressPct}%` }} />
        </div>
        <span className={styles.rankBarNumbers}>{progressLabel}</span>
      </div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Buffer</span>
        <div className={styles.rankBarContainer}>
          <div className={styles.rankBarAmber} style={{ width: `${bufferPct}%` }} />
        </div>
        <span className={styles.rankBarNumbers}>{demotionBuffer} / {config.bufferMax}</span>
      </div>
      {delta && (
        <div className={styles.rankRow}>
          <span className={styles.rankRowLabel}>Last fight</span>
          <span style={{ flex: 1 }}>{renderDelta()}</span>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [boxer, setBoxer] = useState<Boxer | null | undefined>(undefined);
  const [coach, setCoach] = useState<Coach | null | undefined>(undefined);
  const [titleFedMap, setTitleFedMap] = useState<Map<number, { abbr: string; weightClass: string }>>(new Map());
  const [godMode, setGodMode] = useState(false);
  const [gymId, setGymId] = useState<number | null>(null);
  const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
  const [hofEntry, setHofEntry] = useState<import('../../db/db').HallOfFameEntry | null>(null);

  useEffect(() => {
    if (!id) { setBoxer(null); setCoach(null); setHofEntry(null); return; }
    let cancelled = false;

    async function load() {
      const [b, coaches, gym] = await Promise.all([getBoxer(Number(id)), getAllCoaches(), getGym()]);
      if (cancelled) return;
      setGodMode(gym?.godModeEnabled ?? false);
      setGymId(gym?.id ?? null);
      setWatchlistIds(gym?.watchlistIds ?? []);
      setBoxer(b ?? null);
      setCoach(coaches.find(c => c.assignedBoxerId === Number(id)) ?? null);
      if (b?.id !== undefined) {
        const hof = await getHofEntryByBoxer(b.id);
        if (!cancelled) setHofEntry(hof ?? null);
      }

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

  async function handleRetire() {
    if (!boxer || boxer.id === undefined) return;
    if (!window.confirm(`Retire ${boxer.name}? This cannot be undone.`)) return;
    const [allTitles, gym] = await Promise.all([getAllTitles(), getGym()]);
    const currentDate = gym?.currentDate ?? '2026-01-01';
    const result = await retireBoxer(boxer, allTitles, currentDate);
    if (result.inducted) {
      window.alert(`${boxer.name} has been inducted into the Hall of Fame! (Score: ${result.score.toFixed(1)})`);
    }
    navigate('/gym/roster');
  }

  async function handleToggleWatchlist() {
    if (!boxer || boxer.id === undefined) return;
    const boxerId = boxer.id;
    if (watchlistIds.includes(boxerId)) {
      await removeFromWatchlist(boxerId);
      setWatchlistIds(prev => prev.filter(x => x !== boxerId));
    } else {
      await addToWatchlist(boxerId);
      setWatchlistIds(prev => [...prev, boxerId]);
    }
  }

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
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {boxer.name}
          {boxer.id !== undefined && (
            <WatchlistFlag
              isWatchlisted={watchlistIds.includes(boxer.id)}
              isOwnGym={boxer.gymId === gymId && gymId !== null && !boxer.retired}
              onToggle={handleToggleWatchlist}
            />
          )}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{boxer.reputation}</p>
      </div>
      {hofEntry && (
        <div style={{ marginBottom: 8 }}>
          <Link
            to="/league/hall-of-fame"
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: 'var(--accent)',
              color: '#000',
              borderRadius: 3,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            ⭐ Hall of Fame (Score: {hofEntry.score.toFixed(1)})
          </Link>
        </div>
      )}
      {(godMode || (boxer.gymId === gymId && gymId !== null && !boxer.retired)) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {godMode && (
            <Link
              to={`/player/${boxer.id}/edit`}
              style={{
                padding: '5px 14px',
                background: 'none',
                color: 'var(--text-primary)',
                border: '1px solid var(--text-primary)',
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Edit Boxer
            </Link>
          )}
          {godMode && boxer.id !== undefined && (
            <button
              onClick={() => exportBoxer(boxer)}
              style={{
                padding: '5px 14px',
                background: 'none',
                color: 'var(--text-primary)',
                border: '1px solid var(--text-primary)',
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Export Boxer
            </button>
          )}
          {boxer.gymId === gymId && gymId !== null && !boxer.retired && (
            <button
              onClick={handleRetire}
              style={{
                padding: '5px 14px',
                background: 'none',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Retire Boxer
            </button>
          )}
        </div>
      )}
      <div className={styles.page}>

        {/* Header card */}
        <div className={styles.header}>
          <div className={styles.meta}>
            <span>{boxer.age} yrs</span>
            <span>{capitalize(boxer.weightClass)}</span>
            <span>{styleLabel(boxer.style)}</span>
          </div>
          <div className={styles.meta}>
            <span>Born: {formatBirthDate(boxer.birthDate)}</span>
          </div>
          <div className={styles.record}>{calcRecord(boxer.record)} ({boxer.record.length} fights)</div>
          {(activeTitles.length > 0 || boxer.naturalTalents.length > 0) && (
            <div className={styles.tags}>
              {activeTitles.map(t => {
                const info = titleFedMap.get(t.titleId);
                const label = info
                  ? `${info.abbr} ${capitalize(info.weightClass)} Champion`
                  : 'Champion';
                return (
                  <Link
                    key={t.titleId}
                    to={`/league/championship-history#title-${t.titleId}`}
                    className={styles.titleBadge}
                  >
                    {label}
                  </Link>
                );
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
                const isFocus = trainedStats.has(stat);
                const currentExp = boxer.trainingExp?.[stat] ?? 0;
                const threshold = boxer.stats[stat] * 7.5;
                const pct = threshold > 0 ? Math.min(100, (currentExp / threshold) * 100) : 0;
                return (
                  <div key={stat} className={styles.statRow}>
                    <span className={styles.statName}>{STAT_LABELS[stat]}</span>
                    <div className={styles.statBarWrapper}>
                      <div className={isFocus ? styles.statBar : styles.statBarDim}>
                        <div className={styles.statBarFill} style={{ width: `${pct}%` }} />
                        <span className={styles.statBarPct}>{Math.round(pct)}%</span>
                      </div>
                      <span className={styles.statBarValue}>{boxer.stats[stat]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <RankingSection boxer={boxer} />

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
                  <th>Age</th>
                  <th>Opp. Age</th>
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
                    <td>{fight.ageAtFight ?? '—'}</td>
                    <td>{fight.opponentAgeAtFight ?? '—'}</td>
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
