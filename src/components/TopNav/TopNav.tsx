import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers, putBoxer, getBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { getFight } from '../../db/fightStore';
import { getFederation } from '../../db/federationStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import { applyTraining } from '../../lib/training';
import { simulateFight } from '../../lib/fightSim';
import { applyFightResult } from './fightResultApplier';
import { refreshRecruitPool } from '../../db/worldGen';
import { simulateNpcFights } from '../../lib/npcFightSim';
import { runCoachSalaries } from '../../lib/coachSalaries';
import type { CalendarEvent, Gym, Boxer } from '../../db/db';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/league', label: 'League' },
  { to: '/gym', label: 'Gym' },
  { to: '/players', label: 'Players' },
  { to: '/tools', label: 'Tools' },
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

async function runTraining(fromDate: string, toDate: string, gymId: number) {
  const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
  const gymBoxers = allBoxers.filter(b => b.gymId === gymId && b.id !== undefined);
  const days = Math.max(0, dateDiffDays(fromDate, toDate));
  if (days === 0) return;

  await Promise.all(
    gymBoxers.map(boxer => {
      const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
      if (!coach) return Promise.resolve();
      const updated = applyTraining(boxer, coach, days);
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getGym(), getAllCalendarEvents(), getAllBoxers()]).then(
      ([g, evts, boxers]) => {
        setGym(g ?? null);
        setEvents(evts);
        const gymId = g?.id ?? 1;
        const ids = new Set(
          boxers
            .filter(b => b.gymId === gymId && b.id !== undefined)
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

  async function handleSim(days: number | 'next') {
    if (!gym || isSimming) return;
    setIsSimming(true);
    setFightStop(null);  // clear stale banner before new sim
    setRankChanges([]);
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

      const newMonth = result.newDate.slice(0, 7); // 'YYYY-MM'
      const needsRecruitRefresh = (gym.recruitRefreshDate ?? '') !== newMonth;
      const updated: Gym = {
        ...gym,
        currentDate: result.newDate,
        ...(needsRecruitRefresh ? { recruitRefreshDate: newMonth } : {}),
      };
      await saveGym(updated);
      setGym(updated);
      setFightStop(result.stoppedAt);

      await runTraining(currentDate, result.newDate, updated.id ?? 1);
      await simulateNpcFights(currentDate, result.newDate);
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
          .filter(b => b.gymId === freshGymId && b.id !== undefined)
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
    try {
      // Find all fight events for today involving gym boxers
      const todayFights = events.filter(
        e => e.type === 'fight' && e.date === currentDate && e.boxerIds.some(id => gymBoxerIds.has(id))
      );

      for (const event of todayFights) {
        const fight = await getFight(event.fightId);
        if (!fight || fight.winnerId !== null) continue; // already resolved

        const [boxerA, boxerB, federation] = await Promise.all([
          getBoxer(fight.boxerIds[0]),
          getBoxer(fight.boxerIds[1]),
          getFederation(fight.federationId),
        ]);
        if (!boxerA || !boxerB || !federation) continue;

        const simResult = simulateFight(boxerA, boxerB, fight, federation.name);

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
        });

        const [updatedWinner, updatedLoser] = await Promise.all([
          getBoxer(simResult.winnerId),
          getBoxer(simResult.loserId),
        ]);
        const changes: Array<{ name: string; delta: NonNullable<Boxer['lastRankDelta']>; reputation: string }> = [];
        if (updatedWinner?.lastRankDelta) {
          changes.push({ name: updatedWinner.name, delta: updatedWinner.lastRankDelta, reputation: updatedWinner.reputation });
        }
        if (updatedLoser?.lastRankDelta) {
          changes.push({ name: updatedLoser.name, delta: updatedLoser.lastRankDelta, reputation: updatedLoser.reputation });
        }
        setRankChanges(prev => [...prev, ...changes]);
      }

      // Advance date and run training
      const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
      await saveGym(updated);
      setGym(updated);
      setFightStop(null);

      await runTraining(currentDate, updated.currentDate, updated.id ?? 1);

      const [freshEvts, freshBoxers] = await Promise.all([
        getAllCalendarEvents(),
        getAllBoxers(),
      ]);
      setEvents(freshEvts);
      const freshGymId = updated.id ?? 1;
      const freshIds = new Set(
        freshBoxers
          .filter(b => b.gymId === freshGymId && b.id !== undefined)
          .map(b => b.id!)
      );
      setGymBoxerIds(freshIds);
      window.dispatchEvent(new CustomEvent('game:sim'));
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

      {rankChanges.length > 0 && (
        <div className={styles.fightBanner}>
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
          <button className={styles.dismissBtn} onClick={() => setRankChanges([])}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
