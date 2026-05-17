import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers, putBoxer, getBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { getFight, getAllFights } from '../../db/fightStore';
import { getFederation } from '../../db/federationStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import { applyTraining, computeTrainingCampBoost, computeNpcBoost } from '../../lib/training';
import { simulateFight } from '../../lib/fightSim';
import { applyFightResult } from './fightResultApplier';
import { refreshRecruitPool } from '../../db/worldGen';
import { shouldAgeBoxer, applyStatRegression } from '../../lib/aging';
import { simulateNpcFights } from '../../lib/npcFightSim';
import { runCoachSalaries } from '../../lib/coachSalaries';
import type { CalendarEvent, Gym, Boxer, Fight, Coach, BoxerStats } from '../../db/db';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/league', label: 'League' },
  { to: '/gym', label: 'Gym' },
  { to: '/players', label: 'Players' },
  { to: '/tools', label: 'Tools' },
  { to: '/info', label: 'Info' },
];

function formatGameDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateDiffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

async function runAgingPass(fromDate: string, toDate: string, boxers: Boxer[]): Promise<void> {
  if (fromDate.slice(0, 7) === toDate.slice(0, 7)) return;
  const newYear = Number(toDate.slice(0, 4));
  const newMonthNum = Number(toDate.slice(5, 7));
  await Promise.all(
    boxers.map(boxer => {
      if (boxer.retired) return Promise.resolve();
      if (!boxer.birthDate || boxer.lastAgedYear === undefined) return Promise.resolve();
      if (!shouldAgeBoxer(boxer.birthDate, boxer.lastAgedYear, newYear, newMonthNum)) return Promise.resolve();
      const aged = { ...boxer, age: boxer.age + 1, lastAgedYear: newYear };
      const regressed = applyStatRegression(aged);
      return putBoxer(regressed);
    })
  );
}

async function runTraining(fromDate: string, toDate: string, gymId: number, gymLevel: number) {
  const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
  const gymBoxers = allBoxers.filter(b => b.gymId === gymId && b.id !== undefined && !b.retired);
  const days = Math.max(0, dateDiffDays(fromDate, toDate));
  if (days === 0) return;

  await Promise.all(
    gymBoxers.map(boxer => {
      const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
      if (!coach) return Promise.resolve();
      const updated = applyTraining(boxer, coach, days, gymLevel);
      return putBoxer(updated);
    })
  );
}

export function TopNav() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gymBoxerIds, setGymBoxerIds] = useState<Set<number>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fightStop, setFightStop] = useState<CalendarEvent | null>(null);
  const [isSimming, setIsSimming] = useState(false);
  const [rankChanges, setRankChanges] = useState<Array<{ name: string; delta: NonNullable<Boxer['lastRankDelta']>; reputation: string }>>([]);
  const [hofInductees, setHofInductees] = useState<Array<{ name: string; score: number }>>([]);
  const [simmedFights, setSimmedFights] = useState<Array<{
    fightId: number;
    winnerId: number | null;
    loserId: number;
    method: string;
    finishingMove: string | null;
    round: number | null;
    time: string | null;
    boxer1Name: string;
    boxer2Name: string;
  }>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith('/fight-results')) {
      setSimmedFights([]);
      setRankChanges([]);
      setHofInductees([]);
    }
  }, [location.pathname]);

  useEffect(() => {
    Promise.all([getGym(), getAllCalendarEvents(), getAllBoxers()]).then(
      ([g, evts, boxers]) => {
        setGym(g ?? null);
        setEvents(evts);
        const gymId = g?.id ?? 1;
        const ids = new Set(
          boxers
            .filter(b => b.gymId === gymId && b.id !== undefined && !b.retired)
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

  async function applyBoostsToBoxers(
    boxerA: Boxer,
    boxerB: Boxer,
    fight: Fight,
    allCoaches: Coach[],
    allCampEvents: CalendarEvent[],
    currentDate: string,
  ): Promise<{ boostedA: Boxer; boostedB: Boxer }> {
    async function applyBoost(boxer: Boxer, isGymBoxer: boolean): Promise<Boxer> {
      if (isGymBoxer) {
        const campEvent = allCampEvents.find(
          e => e.type === 'training-camp' && e.fightId === fight.id && e.boxerIds.includes(boxer.id!)
        );
        const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
        if (campEvent && coach && campEvent.endDate) {
          const deltas = computeTrainingCampBoost(boxer, coach, campEvent.date, campEvent.endDate, currentDate);
          const boostedStats = { ...boxer.stats };
          for (const [stat, delta] of Object.entries(deltas) as [keyof BoxerStats, number][]) {
            boostedStats[stat] = (boostedStats[stat] as number) + delta;
          }
          // Write tempStatBoost to DB so clearing logic in fightResultApplier works
          if (Object.keys(deltas).length > 0) {
            await putBoxer({ ...boxer, tempStatBoost: { stats: deltas, expiresOnFightId: fight.id! } });
          }
          return { ...boxer, stats: boostedStats };
        }
        return boxer;
      } else {
        const deltas = computeNpcBoost(boxer);
        const boostedStats = { ...boxer.stats };
        for (const [stat, delta] of Object.entries(deltas) as [keyof BoxerStats, number][]) {
          boostedStats[stat] = (boostedStats[stat] as number) + delta;
        }
        return { ...boxer, stats: boostedStats };
      }
    }

    return {
      boostedA: await applyBoost(boxerA, gymBoxerIds.has(boxerA.id!)),
      boostedB: await applyBoost(boxerB, gymBoxerIds.has(boxerB.id!)),
    };
  }

  async function handleSim(days: number | 'next') {
    if (!gym || isSimming) return;
    setIsSimming(true);
    setFightStop(null);  // clear stale banner before new sim
    setRankChanges([]);
    setSimmedFights([]);
    setHofInductees([]);
    setDropdownOpen(false);

    try {
      const currentDate = gym.currentDate ?? '2026-01-01';
      let result;

      if (days === 'next') {
        const freshEvts = await getAllCalendarEvents();
        const nextDate = nextEventDate(currentDate, freshEvts, gymBoxerIds);
        const target = nextDate ?? addDays(currentDate, 7);
        const fightAtTarget = nextDate
          ? freshEvts.find(
              e => e.date === nextDate && e.boxerIds.some(id => gymBoxerIds.has(id))
            ) ?? null
          : null;
        result = { newDate: target, stoppedAt: fightAtTarget };
      } else {
        result = simForward(currentDate, days, events, gymBoxerIds);
      }

      const freshGymForDate = await getGym();
      const newMonth = result.newDate.slice(0, 7); // 'YYYY-MM'
      const needsRecruitRefresh = ((freshGymForDate ?? gym).recruitRefreshDate ?? '') !== newMonth;
      const updated: Gym = {
        ...(freshGymForDate ?? gym),
        currentDate: result.newDate,
        ...(needsRecruitRefresh ? { recruitRefreshDate: newMonth } : {}),
      };
      await saveGym(updated);
      setGym(updated);
      setFightStop(result.stoppedAt);

      // Fetch all boxers once for aging and tempStatBoost clearing
      const allBoxersSnapshot = await getAllBoxers();

      await runAgingPass(currentDate, result.newDate, allBoxersSnapshot);

      await runTraining(currentDate, result.newDate, updated.id ?? 1, updated.level);
      // Clear tempStatBoost for gym boxers whose fight day has passed without being played
      {
        const allGymBoxers = allBoxersSnapshot;
        const gymBoxerList = allGymBoxers.filter(b => b.gymId === (updated.id ?? 1) && b.id !== undefined && !b.retired);
        const allFightsData = await getAllFights();
        const fightDateMap = new Map(allFightsData.filter(f => f.id !== undefined).map(f => [f.id!, f.date]));
        await Promise.all(
          gymBoxerList
            .filter(b => {
              const boost = b.tempStatBoost;
              if (!boost) return false;
              const fightDate = fightDateMap.get(boost.expiresOnFightId);
              return fightDate !== undefined && fightDate <= result.newDate;
            })
            .map(b => putBoxer({ ...b, tempStatBoost: undefined }))
        );
      }
      const retireResults = await simulateNpcFights(currentDate, result.newDate);
      const newInductees = retireResults
        .filter(r => r.inducted)
        .map(r => ({ name: r.boxerName, score: Math.round(r.score) }));
      if (newInductees.length > 0) setHofInductees(prev => [...prev, ...newInductees]);
      await runCoachSalaries(currentDate, result.newDate, updated.id ?? 1);

      if (needsRecruitRefresh) {
        await refreshRecruitPool();
      }

      // Re-fetch events so newly scheduled fights are visible to future sims
      const [freshEvts, freshBoxers] = await Promise.all([
        getAllCalendarEvents(),
        getAllBoxers(),
      ]);
      setEvents(freshEvts);
      const freshGymId = updated.id ?? 1;
      const freshIds = new Set(
        freshBoxers
          .filter(b => b.gymId === freshGymId && b.id !== undefined && !b.retired)
          .map(b => b.id!)
      );
      setGymBoxerIds(freshIds);
      window.dispatchEvent(new CustomEvent('game:sim'));
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
    const currentDate = gym?.currentDate ?? '2026-01-01';
    if (!gym || isSimming) return;
    setIsSimming(true);
    setDropdownOpen(false);
    setRankChanges([]);
    setSimmedFights([]);
    try {
      // Find all fight events for today involving gym boxers
      const todayFights = events.filter(
        e => e.type === 'fight' && e.date === currentDate && e.boxerIds.some(id => gymBoxerIds.has(id))
      );

      for (const event of todayFights) {
        const fight = await getFight(event.fightId);
        if (!fight || fight.winnerId !== null || fight.method === 'Draw') continue; // already resolved

        const [boxerA, boxerB, federation, allCoaches, allCampEvents] = await Promise.all([
          getBoxer(fight.boxerIds[0]),
          getBoxer(fight.boxerIds[1]),
          getFederation(fight.federationId),
          getAllCoaches(),
          getAllCalendarEvents(),
        ]);
        if (!boxerA || !boxerB || !federation) continue;

        const { boostedA, boostedB } = await applyBoostsToBoxers(
          boxerA, boxerB, fight, allCoaches, allCampEvents, currentDate,
        );
        const simResult = simulateFight(boostedA, boostedB, fight, federation.name);

        await applyFightResult({
          fightId: fight.id!,
          winnerId: simResult.winnerId,
          loserId: simResult.loserId,
          method: simResult.method,
          finishingMove: simResult.finishingMove,
          round: simResult.round,
          time: simResult.time,
          winnerRecord: simResult.winnerRecord,
          loserRecord: simResult.loserRecord,
          isTitleFight: fight.isTitleFight,
          federationId: fight.federationId,
          weightClass: fight.weightClass,
          fightDate: fight.date,
          contractId: fight.contractId,
          gymBoxerFirstId: fight.boxerIds[0],
        });

        const [updatedWinner, updatedLoser] = await Promise.all([
          getBoxer(simResult.winnerId),
          getBoxer(simResult.loserId),
        ]);
        setSimmedFights(prev => [...prev, {
          fightId: fight.id!,
          winnerId: simResult.winnerId,
          loserId: simResult.loserId,
          method: simResult.method,
          finishingMove: simResult.finishingMove,
          round: simResult.round,
          time: simResult.time,
          boxer1Name: updatedWinner?.name ?? `Boxer #${simResult.winnerId}`,
          boxer2Name: updatedLoser?.name ?? `Boxer #${simResult.loserId}`,
        }]);
        const changes: Array<{ name: string; delta: NonNullable<Boxer['lastRankDelta']>; reputation: string }> = [];
        if (updatedWinner?.lastRankDelta) {
          changes.push({ name: updatedWinner.name, delta: updatedWinner.lastRankDelta, reputation: updatedWinner.reputation });
        }
        if (updatedLoser?.lastRankDelta) {
          changes.push({ name: updatedLoser.name, delta: updatedLoser.lastRankDelta, reputation: updatedLoser.reputation });
        }
        setRankChanges(prev => [...prev, ...changes]);
      }

      // Advance date and run training — re-fetch gym first so we don't clobber
      // the balance that logTransaction just wrote during payout processing
      const freshGym = await getGym();
      const updated: Gym = { ...(freshGym ?? gym), currentDate: addDays(currentDate, 1) };
      await saveGym(updated);
      setGym(updated);
      setFightStop(null);

      await runTraining(currentDate, updated.currentDate, updated.id ?? 1, updated.level);

      const allBoxersForAging = await getAllBoxers();
      await runAgingPass(currentDate, updated.currentDate, allBoxersForAging);

      const [freshEvts, freshBoxers] = await Promise.all([
        getAllCalendarEvents(),
        getAllBoxers(),
      ]);
      setEvents(freshEvts);
      const freshGymId = updated.id ?? 1;
      const freshIds = new Set(
        freshBoxers
          .filter(b => b.gymId === freshGymId && b.id !== undefined && !b.retired)
          .map(b => b.id!)
      );
      setGymBoxerIds(freshIds);
      window.dispatchEvent(new CustomEvent('game:sim'));

      const simmedIds = todayFights.map(e => e.fightId);
      if (simmedIds.length > 0) {
        navigate(`/fight-results?fights=${simmedIds.join(',')}`);
      }
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

      {simmedFights.length > 0 && (
        <div className={styles.fightBanner}>
          <div className={styles.fightResultsSection}>
            <strong>Fight Day Results</strong>
            {simmedFights.map((f, i) => {
              const isDecision = f.method === 'Decision' || f.method === 'Split Decision';
              const summary = f.winnerId === null
                ? 'Draw'
                : isDecision
                  ? `${f.boxer1Name} wins by ${f.method}`
                  : `${f.boxer1Name} wins by ${f.method}${f.finishingMove ? ` (${f.finishingMove})` : ''}${f.round != null ? ` — Rd. ${f.round}` : ''}`;
              return (
                <div key={f.fightId}>
                  {i > 0 && <hr className={styles.fightResultDivider} />}
                  <div className={styles.fightResultLine}>{summary}</div>
                </div>
              );
            })}
            <button
              className={styles.viewResultsBtn}
              onClick={() => navigate(`/fight-results?fights=${simmedFights.map(f => f.fightId).join(',')}`)}
            >
              View Full Results →
            </button>
          </div>
          <button className={styles.dismissBtn} onClick={() => setSimmedFights([])}>Dismiss</button>
        </div>
      )}

      {rankChanges.length > 0 && (
        <div className={styles.fightBanner}>
          <div className={styles.fightResultsSection}>
            {rankChanges.map((change, i) => {
              const { name, delta, reputation } = change;
              if (delta.promoted) return (
                <div key={i} className={styles.rankChangeLine}>
                  <span className={styles.rankChangePromoted}>{name}: Promoted to {reputation}!</span>
                </div>
              );
              if (delta.demoted) return (
                <div key={i} className={styles.rankChangeLine}>
                  <span className={styles.rankChangeDemoted}>{name}: Demoted to {reputation}</span>
                </div>
              );
              if (delta.points > 0) return (
                <div key={i} className={styles.rankChangeLine}>
                  {name}: <span className={styles.rankChangePromoted}>+{delta.points} rank pts</span> ({reputation})
                </div>
              );
              if (delta.bufferPoints > 0) return (
                <div key={i} className={styles.rankChangeLine}>
                  {name}: <span className={styles.rankChangeDemoted}>−{delta.bufferPoints} buffer pts</span> ({reputation})
                </div>
              );
              return null;
            })}
          </div>
          <button className={styles.dismissBtn} onClick={() => setRankChanges([])}>Dismiss</button>
        </div>
      )}

      {hofInductees.length > 0 && (
        <div className={styles.fightBanner}>
          <div className={styles.fightResultsSection}>
            <strong>Hall of Fame!</strong>
            {hofInductees.map((inductee, i) => (
              <div key={i} className={styles.fightResultLine}>
                ⭐ {inductee.name} has been inducted into the Hall of Fame! (Score: {inductee.score})
              </div>
            ))}
          </div>
          <button className={styles.dismissBtn} onClick={() => setHofInductees([])}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
