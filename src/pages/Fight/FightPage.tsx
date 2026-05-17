import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getFight } from '../../db/fightStore';
import { getBoxer, getAllBoxers, putBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCoaches } from '../../db/coachStore';
import { applyFightResult } from '../../components/TopNav/fightResultApplier';
import { addDays } from '../../lib/simTime';
import { calcAgeAtDate } from '../../lib/ageCalc';
import { applyTraining } from '../../lib/training';
import {
  initFightState, simulateRound, pickOpponentChoice,
  STAT_CATEGORIES,
  type FightState,
} from '../../lib/fightSim';
import type { Fight, Boxer, StatCategory, RoundLogEntry } from '../../db/db';
import styles from './FightPage.module.css';

const CATEGORY_LABELS: Record<StatCategory, string> = {
  offense: 'Offense', defense: 'Defense', mental: 'Mental', physical: 'Physical',
};

const STAT_LABELS: Record<string, string> = {
  jab: 'Jab', cross: 'Cross', leadHook: 'Lead Hook', rearHook: 'Rear Hook', uppercut: 'Uppercut',
  headMovement: 'Head Mvmt', bodyMovement: 'Body Mvmt', guard: 'Guard', positioning: 'Positioning',
  timing: 'Timing', adaptability: 'Adaptability', discipline: 'Discipline',
  speed: 'Speed', power: 'Power', endurance: 'Endurance', recovery: 'Recovery', toughness: 'Toughness',
};

const STYLE_THREATS: Record<string, string[]> = {
  'out-boxer':      ['head'],
  'swarmer':        ['body', 'leftArm', 'rightArm'],
  'slugger':        ['chin'],
  'counterpuncher': ['head'],
};

const SESSION_KEY = (fightId: string) => `fight-session-${fightId}`;

function damageColor(pct: number): string {
  if (pct < 25) return '#4caf50';
  if (pct < 60) return '#ff9800';
  return '#f44336';
}

interface RegionDamage {
  head: number; chin: number; body: number; leftArm: number; rightArm: number;
}

function BoxerSilhouette({
  mode,
  regionDamage,
  opponentStyle,
}: {
  mode: 'damage' | 'threat';
  regionDamage?: RegionDamage;
  opponentStyle?: string;
}) {
  const threats = opponentStyle ? STYLE_THREATS[opponentStyle] ?? [] : [];

  function regionFill(region: keyof RegionDamage): string {
    if (mode === 'damage' && regionDamage) {
      return damageColor(regionDamage[region]);
    }
    if (mode === 'threat') {
      return threats.includes(region) ? '#f44336' : '#555';
    }
    return '#555';
  }

  return (
    <svg width="80" height="160" viewBox="0 0 80 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="18" rx="14" ry="16" fill={regionFill('head')} opacity="0.85" />
      <ellipse cx="40" cy="33" rx="8" ry="6" fill={regionFill('chin')} opacity="0.85" />
      <rect x="22" y="40" width="36" height="50" rx="6" fill={regionFill('body')} opacity="0.85" />
      <rect x="6" y="42" width="14" height="40" rx="6" fill={regionFill('leftArm')} opacity="0.85" />
      <rect x="60" y="42" width="14" height="40" rx="6" fill={regionFill('rightArm')} opacity="0.85" />
      <rect x="24" y="92" width="13" height="50" rx="5" fill="#444" opacity="0.7" />
      <rect x="43" y="92" width="13" height="50" rx="5" fill="#444" opacity="0.7" />
    </svg>
  );
}

function BarPair({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className={styles.barLabel}>{label}</div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${label === 'Health' ? styles.barFillHealth : styles.barFillStamina}`}
          style={{ width: `${Math.max(0, value)}%` }}
        />
      </div>
      <div className={styles.barPct}>{Math.round(value)}%</div>
    </div>
  );
}

export default function FightPage() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  const [fight, setFight] = useState<Fight | null>(null);
  const [player, setPlayer] = useState<Boxer | null>(null);
  const [opponent, setOpponent] = useState<Boxer | null>(null);
  const [loading, setLoading] = useState(true);

  const [fightState, setFightState] = useState<FightState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<StatCategory | null>(null);
  const [selectedStat, setSelectedStat] = useState<keyof Boxer['stats'] | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  const [playerRegionDamage, setPlayerRegionDamage] = useState<RegionDamage>({
    head: 0, chin: 0, body: 0, leftArm: 0, rightArm: 0,
  });

  const autoNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!fightId) return;
    const id = Number(fightId);

    async function load() {
      const f = await getFight(id);
      if (!f) { setLoading(false); return; }
      setFight(f);

      const [p, opp] = await Promise.all([
        getBoxer(f.boxerIds[0]),
        getBoxer(f.boxerIds[1]),
      ]);
      setPlayer(p ?? null);
      setOpponent(opp ?? null);

      if (f.winnerId === null && f.method !== 'Draw') {
        const saved = sessionStorage.getItem(SESSION_KEY(fightId));
        if (saved) {
          try {
            const parsed: FightState = JSON.parse(saved);
            if (!parsed.finished) {
              setFightState(parsed);
              setLoading(false);
              return;
            }
          } catch {
            // corrupt — start fresh
          }
        }
        setFightState(initFightState());
      }
      setLoading(false);
    }

    load();
  }, [fightId]);

  useEffect(() => {
    if (!fightId || !fightState) return;
    sessionStorage.setItem(SESSION_KEY(fightId), JSON.stringify(fightState));
  }, [fightId, fightState]);

  const handleSimulateRound = useCallback(async () => {
    if (!fightState || !player || !opponent || !selectedCategory || !selectedStat || isApplying) return;
    const next = simulateRound(fightState, player, opponent, { category: selectedCategory, stat: selectedStat });

    const threats = STYLE_THREATS[opponent.style] ?? ['body'];
    const lastEntry = next.roundLog[next.roundLog.length - 1];
    const dmgPerRegion = (lastEntry?.opponentDamageDealt ?? 0) / threats.length;
    setPlayerRegionDamage(prev => {
      const updated = { ...prev };
      for (const region of threats) {
        if (region in updated) updated[region as keyof RegionDamage] += dmgPerRegion;
      }
      return updated;
    });

    setFightState(next);
    setSelectedCategory(null);
    setSelectedStat(null);

    if (next.finished && next.result) {
      setIsApplying(true);
      try {
        const f = fight!;
        const fed = await getFederation(f.federationId);
        const { winnerId, loserId, method, finishingMove, round, time } = next.result;
        const winner = winnerId === player.id ? player : opponent;
        const loser  = loserId  === player.id ? player : opponent;

        const winnerRecord = {
          result: 'win' as const,
          opponentName: loser.name,
          opponentId: loser.id!,
          method,
          finishingMove,
          round: round!,
          time: time!,
          federation: fed?.name ?? '',
          date: f.date,
          isTitleFight: f.isTitleFight,
          ageAtFight: calcAgeAtDate(winner.birthDate, f.date),
          opponentAgeAtFight: calcAgeAtDate(loser.birthDate, f.date),
        };
        const loserRecord = {
          result: 'loss' as const,
          opponentName: winner.name,
          opponentId: winner.id!,
          method,
          finishingMove,
          round: round!,
          time: time!,
          federation: fed?.name ?? '',
          date: f.date,
          isTitleFight: f.isTitleFight,
          ageAtFight: calcAgeAtDate(loser.birthDate, f.date),
          opponentAgeAtFight: calcAgeAtDate(winner.birthDate, f.date),
        };

        await applyFightResult({
          fightId: f.id!,
          winnerId, loserId, method, finishingMove,
          round: round!,
          time: time!,
          winnerRecord, loserRecord,
          isTitleFight: f.isTitleFight,
          federationId: f.federationId,
          weightClass: f.weightClass,
          fightDate: f.date,
          contractId: f.contractId,
          gymBoxerFirstId: f.boxerIds[0],
          roundLog: next.roundLog,
        });

        // Advance game date by 1 and run 1 day of training (mirrors handleSimFight in TopNav)
        const freshGym = await getGym();
        if (freshGym) {
          const nextDate = addDays(f.date, 1);
          await saveGym({ ...freshGym, currentDate: nextDate });
          const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
          const gymBoxers = allBoxers.filter(b => b.gymId === (freshGym.id ?? 1) && b.id !== undefined);
          await Promise.all(
            gymBoxers.map(boxer => {
              const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
              if (!coach) return Promise.resolve();
              return putBoxer(applyTraining(boxer, coach, 1, freshGym.level));
            })
          );
        }
        window.dispatchEvent(new CustomEvent('game:sim'));

        sessionStorage.removeItem(SESSION_KEY(fightId!));
        setShowRecap(true);

        autoNavTimer.current = setTimeout(() => {
          navigate(`/fight-results?fights=${f.id}`);
        }, 8000);
      } finally {
        setIsApplying(false);
      }
    }
  }, [fightState, player, opponent, selectedCategory, selectedStat, isApplying, fight, fightId, navigate]);

  const handleSimToEnd = useCallback(async () => {
    if (!fightState || !player || !opponent || isApplying) return;
    setIsApplying(true);

    let state = fightState;
    const regionDmg: RegionDamage = { ...playerRegionDamage };
    const threats = STYLE_THREATS[opponent.style] ?? ['body'];

    while (!state.finished) {
      const choice = pickOpponentChoice(player);
      state = simulateRound(state, player, opponent, choice);
      const lastEntry = state.roundLog[state.roundLog.length - 1];
      const dmgPerRegion = (lastEntry?.opponentDamageDealt ?? 0) / threats.length;
      for (const region of threats) {
        if (region in regionDmg) regionDmg[region as keyof RegionDamage] += dmgPerRegion;
      }
    }

    setPlayerRegionDamage(regionDmg);
    setFightState(state);

    try {
      const f = fight!;
      const fed = await getFederation(f.federationId);
      const { winnerId, loserId, method, finishingMove, round, time } = state.result!;
      const winner = winnerId === player.id ? player : opponent;
      const loser  = loserId  === player.id ? player : opponent;

      const winnerRecord = {
        result: 'win' as const,
        opponentName: loser.name,
        opponentId: loser.id!,
        method,
        finishingMove,
        round: round!,
        time: time!,
        federation: fed?.name ?? '',
        date: f.date,
        isTitleFight: f.isTitleFight,
        ageAtFight: calcAgeAtDate(winner.birthDate, f.date),
        opponentAgeAtFight: calcAgeAtDate(loser.birthDate, f.date),
      };
      const loserRecord = {
        result: 'loss' as const,
        opponentName: winner.name,
        opponentId: winner.id!,
        method,
        finishingMove,
        round: round!,
        time: time!,
        federation: fed?.name ?? '',
        date: f.date,
        isTitleFight: f.isTitleFight,
        ageAtFight: calcAgeAtDate(loser.birthDate, f.date),
        opponentAgeAtFight: calcAgeAtDate(winner.birthDate, f.date),
      };

      await applyFightResult({
        fightId: f.id!,
        winnerId, loserId, method, finishingMove,
        round: round!,
        time: time!,
        winnerRecord, loserRecord,
        isTitleFight: f.isTitleFight,
        federationId: f.federationId,
        weightClass: f.weightClass,
        fightDate: f.date,
        contractId: f.contractId,
        gymBoxerFirstId: f.boxerIds[0],
        roundLog: state.roundLog,
      });

      const freshGym = await getGym();
      if (freshGym) {
        const nextDate = addDays(f.date, 1);
        await saveGym({ ...freshGym, currentDate: nextDate });
        const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
        const gymBoxers = allBoxers.filter(b => b.gymId === (freshGym.id ?? 1) && b.id !== undefined);
        await Promise.all(
          gymBoxers.map(boxer => {
            const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
            if (!coach) return Promise.resolve();
            return putBoxer(applyTraining(boxer, coach, 1, freshGym.level));
          })
        );
      }
      window.dispatchEvent(new CustomEvent('game:sim'));

      sessionStorage.removeItem(SESSION_KEY(fightId!));
      setShowRecap(true);

      autoNavTimer.current = setTimeout(() => {
        navigate(`/fight-results?fights=${f.id}`);
      }, 8000);
    } finally {
      setIsApplying(false);
    }
  }, [fightState, player, opponent, isApplying, playerRegionDamage, fight, fightId, navigate]);

  useEffect(() => {
    return () => {
      if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
    };
  }, []);

  const back = (
    <button
      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16 }}
      onClick={() => navigate(-1)}
    >
      &larr; Back
    </button>
  );

  if (loading) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p></div>;
  if (!fight) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight not found.</p></div>;

  const isCompleted = fight.winnerId !== null || fight.method === 'Draw';
  if (isCompleted && !showRecap) {
    const isDraw = fight.method === 'Draw';
    const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
    const winnerName = fight.winnerId ? (fight.winnerId === player?.id ? player?.name : opponent?.name) ?? `Boxer #${fight.winnerId}` : '—';
    const resultLine = isDraw
      ? `Draw — ${fight.method}`
      : isDecision
        ? `${winnerName} wins by ${fight.method}`
        : `${winnerName} wins by ${fight.method}${fight.finishingMove ? ` (${fight.finishingMove})` : ''}${fight.round != null ? ` — Rd. ${fight.round}` : ''}`;

    return (
      <div style={{ padding: '32px 24px', maxWidth: 600 }}>
        {back}
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>
          {player?.name ?? `Boxer #${fight.boxerIds[0]}`} vs. {opponent?.name ?? `Boxer #${fight.boxerIds[1]}`}
        </h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
          {fight.date} {fight.isTitleFight && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>· Title Fight</span>}
        </p>
        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 6, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>Result</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{resultLine}</div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 16 }}>
          {player?.id !== undefined && <Link to={`/player/${player.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{player.name}</Link>}
          {opponent?.id !== undefined && <Link to={`/player/${opponent.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{opponent.name}</Link>}
        </div>
      </div>
    );
  }

  if (showRecap && fightState) {
    const res = fightState.result;
    const winnerName = res?.winnerId === player?.id ? player?.name : opponent?.name;
    return (
      <div className={styles.fightContainer}>
        {back}
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Fight Over</h2>
        {res && (
          <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 20 }}>
            {winnerName} wins by {res.method}
            {res.finishingMove ? ` (${res.finishingMove})` : ''}
            {res.round ? ` — Rd. ${res.round}` : ''}
          </p>
        )}
        <div className={styles.recapSection}>
          <div className={styles.recapTitle}>Round-by-Round</div>
          {fightState.roundLog.map((entry: RoundLogEntry) => (
            <div key={entry.round} className={styles.recapEntry}>
              <div className={styles.recapRound}>Round {entry.round}</div>
              <div className={styles.recapNarrative}>{entry.narrative}</div>
              <div className={styles.recapScore}>
                You: {entry.playerScoreThisRound} — Opponent: {entry.opponentScoreThisRound}
                {entry.adaptationPenalty > 0 && ` · Adaptation penalty: −${Math.round(entry.adaptationPenalty * 100)}%`}
              </div>
            </div>
          ))}
        </div>
        <button
          className={styles.viewResultsBtn}
          onClick={() => {
            if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
            navigate(`/fight-results?fights=${fight.id}`);
          }}
        >
          View Full Results →
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Auto-navigating in 8s…</p>
      </div>
    );
  }

  if (!fightState || !player || !opponent) {
    return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight not ready.</p></div>;
  }

  const lastEntry = fightState.roundLog[fightState.roundLog.length - 1];
  const statsForCategory = selectedCategory ? STAT_CATEGORIES[selectedCategory] : [];
  const penaltyRate = (opponent.stats.adaptability as number) >= 15 ? 0.15 : 0.10;
  const nextPenalty = Math.min(0.5, (selectedStat === fightState.lastPlayerStat ? fightState.repeatCount + 1 : 0) * penaltyRate);

  return (
    <div className={styles.fightContainer}>
      {back}

      <div className={styles.header}>
        <span className={styles.boxerName}>{player.name}</span>
        <span className={styles.roundLabel}>Round {Math.min(fightState.round, 12)} / 12</span>
        <span className={styles.boxerName}>{opponent.name}</span>
      </div>

      <div className={styles.barsSection}>
        <div>
          <BarPair label="Health"  value={fightState.playerHealth} />
          <BarPair label="Stamina" value={fightState.playerStamina} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>vs</div>
        <div className={styles.opponentBars}>
          <BarPair label="Health"  value={fightState.opponentHealth} />
          <BarPair label="Stamina" value={fightState.opponentStamina} />
        </div>
      </div>

      <div className={styles.svgSection}>
        <div className={styles.svgWrapper}>
          <div className={styles.svgLabel}>Your Damage</div>
          <BoxerSilhouette mode="damage" regionDamage={playerRegionDamage} />
        </div>
        <div className={styles.svgWrapper}>
          <div className={styles.svgLabel}>Threat Zones</div>
          <BoxerSilhouette mode="threat" opponentStyle={opponent.style} />
        </div>
      </div>

      <div className={styles.pickerSection}>
        <div className={styles.pickerTitle}>Choose Your Focus</div>
        <div className={styles.categoryRow}>
          {(['offense', 'defense', 'mental', 'physical'] as StatCategory[]).map(cat => (
            <button
              key={cat}
              className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ''}`}
              onClick={() => { setSelectedCategory(cat); setSelectedStat(null); }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {selectedCategory && (
          <div className={styles.statRow}>
            {statsForCategory.map(stat => {
              const isActive = selectedStat === stat;
              const wouldRepeat = stat === fightState.lastPlayerStat;
              const previewPenalty = wouldRepeat ? Math.min(0.5, (fightState.repeatCount + 1) * penaltyRate) : 0;
              return (
                <button
                  key={stat}
                  className={`${styles.statBtn} ${isActive ? styles.statBtnActive : ''}`}
                  onClick={() => setSelectedStat(stat)}
                >
                  {STAT_LABELS[stat] ?? stat}
                  {wouldRepeat && previewPenalty >= 0.20 && !isActive && (
                    <span className={styles.adaptBadge}>−{Math.round(previewPenalty * 100)}%</span>
                  )}
                  {isActive && nextPenalty >= 0.20 && (
                    <span className={styles.adaptBadge}>−{Math.round(nextPenalty * 100)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.narrativeSection}>
        {lastEntry ? (
          <>
            <div className={styles.narrativeTitle}>Round {lastEntry.round} recap</div>
            {lastEntry.narrative}
          </>
        ) : (
          <span style={{ fontStyle: 'italic' }}>Fight begins — choose your focus for Round 1.</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className={styles.simBtn}
          onClick={handleSimulateRound}
          disabled={!selectedCategory || !selectedStat || isApplying}
        >
          {isApplying ? 'Applying…' : 'Simulate Round'}
        </button>
        <button
          className={styles.simBtn}
          onClick={handleSimToEnd}
          disabled={isApplying}
          style={{ opacity: 0.8 }}
        >
          {isApplying ? 'Applying…' : 'Sim to End'}
        </button>
      </div>
    </div>
  );
}
