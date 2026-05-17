import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord } from '../../db/db';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents, putCalendarEvent, deleteCalendarEvent } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import { dateDiffDaysTraining } from '../../lib/training';
import { getAllCoaches } from '../../db/coachStore';
import type { Coach } from '../../db/db';
import { FEDERATION_ABBR } from '../../constants/federations';
import { RANK_CONFIG } from '../../lib/rankSystem';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Exported helpers ---

export interface BoxerStatus {
  label: string;
  variant: 'danger' | 'warning' | 'muted' | 'success';
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string,
  boostPct?: number,
): BoxerStatus {
  if (boxer.id === undefined) return { label: 'Active', variant: 'success' };
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, variant: 'danger' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date >= today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    const label = boostPct !== undefined && boostPct > 0
      ? `In Training Camp · +${boostPct}%`
      : 'In Training Camp';
    return { label, variant: 'warning' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', variant: 'muted' };
  }
  return { label: 'Active', variant: 'success' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  if (boxer.id === undefined) return null;
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (boxersMap.get(opponentId)?.name ?? 'Unknown')
    : 'Unknown';

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? (FEDERATION_ABBR[federation.name] ?? federation.name) : '?';
  const [year, month, day] = soonest.date.split('-').map(Number);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} vs. ${opponentName} (${abbr})`;
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function styleLabel(style: string): string {
  return style.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function computeCampBoostPct(
  campStartDate: string,
  fightDate: string,
  currentDate: string,
): number {
  const totalDays = Math.min(60, Math.max(0, dateDiffDaysTraining(campStartDate, fightDate)));
  const trainedDays = Math.min(totalDays, Math.max(0, dateDiffDaysTraining(campStartDate, currentDate)));

  if (totalDays === 0 || trainedDays === 0) return 0;

  const earlySegment = Math.max(0, totalDays - 14);
  const earlyDays = Math.min(trainedDays, earlySegment);
  const lateDays = Math.max(0, trainedDays - earlySegment);

  const earlyFraction = earlySegment > 0 ? (earlyDays / earlySegment) * 0.80 : 0;
  const lateFraction = lateDays > 0 ? (lateDays / 14) * 0.20 : 0;
  return Math.round((earlyFraction + lateFraction) * 50);
}

// --- Component ---

export function RankMiniBar({ boxer }: { boxer: Boxer }) {
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
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <span className="text-[11px] text-zinc-400 whitespace-nowrap">{boxer.reputation}</span>
      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${bufferPct}%` }} />
      </div>
    </div>
  );
}

export default function Roster() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fightsMap, setFightsMap] = useState<Map<number, Fight>>(new Map());
  const [federationsMap, setFederationsMap] = useState<Map<number, Federation>>(new Map());
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [_coaches, setCoaches] = useState<Coach[]>([]);
  const [campEvents, setCampEvents] = useState<CalendarEvent[]>([]);
  const [campFormBoxerId, setCampFormBoxerId] = useState<number | null>(null);
  const [campStartInput, setCampStartInput] = useState('');

  const navigate = useNavigate();

  async function handleStartCamp(boxerId: number, fightId: number, fightDate: string) {
    if (!campStartInput) return;
    await putCalendarEvent({
      type: 'training-camp',
      date: campStartInput,
      endDate: fightDate,
      fightId,
      boxerIds: [boxerId],
    });
    setCampFormBoxerId(null);
    setCampStartInput('');
    const allEvents = await getAllCalendarEvents();
    setEvents(allEvents);
    setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
  }

  async function handleCancelCamp(campEventId: number) {
    await deleteCalendarEvent(campEventId);
    const allEvents = await getAllCalendarEvents();
    setEvents(allEvents);
    setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxers, allEvents, allFights, allFederations, allCoaches] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
        getAllCoaches(),
      ]);

      if (cancelled) return;

      const gymId = gym?.id ?? 1;
      const gymRoster = allBoxers.filter(b => b.gymId === gymId && !b.retired);

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

      setRoster(gymRoster);
      setEvents(allEvents);
      setFightsMap(fMap);
      setFederationsMap(fedMap);
      setBoxersMap(bMap);
      setToday(gym?.currentDate ?? '');
      setLoading(false);
      setCoaches(allCoaches);
      setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
    }

    load();
    window.addEventListener('game:sim', load);
    return () => {
      cancelled = true;
      window.removeEventListener('game:sim', load);
    };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Roster" subtitle="Current gym members" />
        <p className="text-zinc-400 italic text-sm p-4">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <div className="mt-4">
        {roster.length === 0 ? (
          <p className="text-zinc-500 italic text-sm p-4">No boxers on your roster yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Weight Class</th>
                <th>Style</th>
                <th>Record</th>
                <th>Reputation</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Next Fight</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roster.map(boxer => {
                const nextFightEvent = events
                  .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date >= today)
                  .sort((a, b) => a.date.localeCompare(b.date))[0];

                const campEvent = nextFightEvent
                  ? campEvents.find(e => e.fightId === nextFightEvent.fightId && e.boxerIds.includes(boxer.id!))
                  : undefined;

                const boostPct = campEvent
                  ? computeCampBoostPct(campEvent.date, campEvent.endDate ?? nextFightEvent!.date, today)
                  : undefined;

                const status = getBoxerStatus(boxer, events, today, boostPct);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                const hasActiveFight = events.some(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date >= today);
                const hasActiveInjury = boxer.injuries.some(i => i.recoveryDays > 0);
                const showCampButton = nextFightEvent && !campEvent && !hasActiveInjury;
                const showCampForm = campFormBoxerId === boxer.id;

                return (
                  <tr key={boxer.id}>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{boxer.age}</td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td className="text-zinc-300 font-medium">{styleLabel(boxer.style)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td>{boxer.reputation}</td>
                    <td><RankMiniBar boxer={boxer} /></td>
                    <td>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td>
                      {nextFight
                        ? <span className="text-zinc-300 text-xs">{nextFight}</span>
                        : <span className="text-zinc-600">—</span>
                      }
                    </td>
                    <td>
                      {!hasActiveFight && !hasActiveInjury && (
                        <Button size="sm" onClick={() => navigate(`/league/schedule?boxerId=${boxer.id}`)}>
                          Schedule Fight
                        </Button>
                      )}
                      {campEvent && campEvent.id !== undefined && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelCamp(campEvent.id!)}>
                          Cancel Camp
                        </Button>
                      )}
                      {showCampButton && !showCampForm && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setCampFormBoxerId(boxer.id!);
                            setCampStartInput(today);
                          }}
                        >
                          Start Training Camp
                        </Button>
                      )}
                      {showCampForm && (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="date"
                            className="bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-xs text-zinc-200"
                            value={campStartInput}
                            min={today}
                            max={nextFightEvent!.date}
                            onChange={e => setCampStartInput(e.target.value)}
                          />
                          <Button size="sm" onClick={() => handleStartCamp(boxer.id!, nextFightEvent!.fightId, nextFightEvent!.date)}>
                            Start Camp
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setCampFormBoxerId(null); setCampStartInput(''); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
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
