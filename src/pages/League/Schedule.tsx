import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Federation, FederationEvent, FederationName, FightingStyle, FightRecord, ReputationLevel, BoxerStats, Title } from '../../db/db';
import { getAllFights, putFight } from '../../db/fightStore';
import { putFightContract } from '../../db/fightContractStore';
import { putCalendarEvent, getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFederationEvents, putFederationEvent, updateFederationEventFights } from '../../db/federationEventStore';
import { getAllFederations } from '../../db/federationStore';
import { getAllTitles } from '../../db/titleStore';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import styles from './Schedule.module.css';

// --- Constants ---

export const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer': 'swarmer',
  'swarmer': 'slugger',
  'slugger': 'counterpuncher',
  'counterpuncher': 'out-boxer',
};

const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 1,
  'Rising Star': 2,
  'Respectable Opponent': 3,
  'Contender': 4,
  'Championship Caliber': 5,
  'Nationally Ranked': 6,
  'World Class Fighter': 7,
  'International Superstar': 8,
  'All-Time Great': 9,
};

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTER_WEEKS = [10, 23, 36, 49];

// --- Pure helpers ---

export function matchupLabel(
  gymStyle: FightingStyle,
  opponentStyle: FightingStyle
): 'Counters you' | 'Neutral' | 'You counter' {
  if (STYLE_COUNTERS[gymStyle] === opponentStyle) return 'Counters you';
  if (STYLE_COUNTERS[opponentStyle] === gymStyle) return 'You counter';
  return 'Neutral';
}

export function statAvg(stats: BoxerStats, category: 'offense' | 'defense' | 'physical'): number {
  if (category === 'offense') {
    return (stats.jab + stats.cross + stats.leadHook + stats.rearHook + stats.uppercut) / 5;
  }
  if (category === 'defense') {
    return (stats.headMovement + stats.bodyMovement + stats.guard + stats.positioning) / 4;
  }
  return (stats.speed + stats.power + stats.endurance + stats.recovery + stats.toughness) / 5;
}

export function reputationIndex(rep: ReputationLevel): number {
  return REPUTATION_INDEX[rep];
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function formatEventDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Data shape ---

interface ScheduleData {
  gym: Awaited<ReturnType<typeof getGym>>;
  boxers: Boxer[];
  calendarEvents: CalendarEvent[];
  federationEvents: FederationEvent[];
  federations: Federation[];
  fights: Awaited<ReturnType<typeof getAllFights>>;
  titles: Title[];
}

// --- Component ---

export default function Schedule() {
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<ScheduleData | null>(null);
  const [selectedBoxerId, setSelectedBoxerId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<number | null>(null);
  const [isTitleFight, setIsTitleFight] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, boxers, calendarEvents, federationEvents, federations, fights, titles] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFederationEvents(),
        getAllFederations(),
        getAllFights(),
        getAllTitles(),
      ]);

      if (cancelled) return;

      // Auto-generate events: check if any federation has fewer than 2 future events
      const nextYear = new Date(today).getFullYear() + 1;
      let updatedFederationEvents = [...federationEvents];

      for (const fed of federations) {
        if (fed.id === undefined) continue;
        const fedId = fed.id;
        const futureFedEvents = federationEvents.filter(
          e => e.federationId === fedId && e.date > today
        );
        if (futureFedEvents.length < 2) {
          const abbr = FEDERATION_ABBR[fed.name] ?? fed.name;
          const stagger = Math.floor(Math.abs(fedId * 13) % 7);
          const newEvents: FederationEvent[] = [];
          for (const week of QUARTER_WEEKS) {
            const dayOfYear = week * 7 + stagger;
            const date = new Date(nextYear, 0, dayOfYear);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const isoDate = `${y}-${m}-${d}`;
            const monthName = MONTH_NAMES[date.getMonth()];
            const name = `${abbr} ${monthName} ${nextYear}`;
            const newId = await putFederationEvent({ federationId: fedId, date: isoDate, name, fightIds: [] });
            if (!cancelled) {
              newEvents.push({ id: newId, federationId: fedId, date: isoDate, name, fightIds: [] });
            }
          }
          updatedFederationEvents = [...updatedFederationEvents, ...newEvents];
        }
      }

      if (cancelled) return;

      setData({ gym, boxers, calendarEvents, federationEvents: updatedFederationEvents, federations, fights, titles });

      // Pre-select boxer from query param
      const paramBoxerId = searchParams.get('boxerId');
      if (paramBoxerId) {
        const id = parseInt(paramBoxerId, 10);
        if (!isNaN(id) && gym.rosterIds.includes(id)) {
          setSelectedBoxerId(id);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [today, searchParams]);

  if (data === null) {
    return (
      <div className={styles.page}>
        <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  const { gym, boxers, calendarEvents, federationEvents, federations, fights, titles } = data;

  if (!gym) {
    return (
      <div className={styles.page}>
        <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
        <p className={styles.empty}>No gym found. Start a new game first.</p>
      </div>
    );
  }

  const gymBoxerIds = new Set(gym.rosterIds);
  const gymBoxers = boxers.filter(b => b.id !== undefined && gymBoxerIds.has(b.id));

  // Determine which boxers have a future scheduled fight
  const futureCalendarFightEvents = calendarEvents.filter(e => e.type === 'fight' && e.date >= today);
  const bookedBoxerIds = new Set<number>();
  for (const ev of futureCalendarFightEvents) {
    for (const bid of ev.boxerIds) {
      bookedBoxerIds.add(bid);
    }
  }

  // Determine which boxers have an active injury
  const injuredBoxerIds = new Set<number>();
  for (const boxer of gymBoxers) {
    if (boxer.id === undefined) continue;
    const hasActiveInjury = boxer.injuries.some(inj => inj.recoveryDays > 0);
    if (hasActiveInjury) {
      injuredBoxerIds.add(boxer.id);
    }
  }

  const selectedGymBoxer = selectedBoxerId !== null
    ? gymBoxers.find(b => b.id === selectedBoxerId) ?? null
    : null;

  // Federation events in the future, sorted by date
  const futureEvents = federationEvents
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const selectedEvent = selectedEventId !== null
    ? futureEvents.find(e => e.id === selectedEventId) ?? null
    : null;

  // Map federationId -> Federation
  const fedMap = new Map<number, Federation>(
    federations.filter(f => f.id !== undefined).map(f => [f.id, f])
  );

  // Group future events by federation
  const eventsByFed = new Map<number, FederationEvent[]>();
  for (const ev of futureEvents) {
    const list = eventsByFed.get(ev.federationId) ?? [];
    list.push(ev);
    eventsByFed.set(ev.federationId, list);
  }

  // All boxer ids booked for the selected event
  const opponentsBookedForEvent = new Set<number>();
  if (selectedEvent) {
    for (const fightId of selectedEvent.fightIds) {
      const fight = fights.find(f => f.id === fightId);
      if (fight) {
        for (const bid of fight.boxerIds) {
          opponentsBookedForEvent.add(bid);
        }
      }
    }
  }

  // Opponents: same weight class, not in gym, not booked on selected event
  const opponents = selectedGymBoxer && selectedEvent
    ? boxers.filter(b => {
        if (b.id === undefined) return false;
        if (gymBoxerIds.has(b.id)) return false;
        if (b.weightClass !== selectedGymBoxer.weightClass) return false;
        return true;
      })
    : [];

  // Group opponents by federation
  const opponentsByFed = new Map<number, Boxer[]>();
  for (const opp of opponents) {
    if (opp.federationId === null || opp.federationId === undefined) continue;
    const list = opponentsByFed.get(opp.federationId) ?? [];
    list.push(opp);
    opponentsByFed.set(opp.federationId, list);
  }

  const selectedOpponent = selectedOpponentId !== null
    ? opponents.find(b => b.id === selectedOpponentId) ?? null
    : null;

  // Title fight eligibility: selected event's federation has a title where champion is gym boxer OR opponent
  const titleFightEligible = selectedEvent && selectedGymBoxer && selectedOpponent
    ? titles.some(t => {
        if (t.federationId !== selectedEvent.federationId) return false;
        if (selectedGymBoxer && t.weightClass !== selectedGymBoxer.weightClass) return false;
        return (
          t.currentChampionId === selectedGymBoxer.id ||
          t.currentChampionId === selectedOpponent.id
        );
      })
    : false;

  const canConfirm = selectedGymBoxer !== null && selectedEvent !== null && selectedOpponent !== null;

  async function handleConfirm() {
    if (!canConfirm || !selectedGymBoxer || !selectedEvent || !selectedOpponent) return;
    if (selectedGymBoxer.id === undefined) return;
    if (selectedOpponent.id === undefined) return;
    if (selectedEvent.id === undefined) return;

    const gymBoxerId = selectedGymBoxer.id;
    const opponentId = selectedOpponent.id;
    const eventId = selectedEvent.id;

    setConfirming(true);
    try {
      // 1. Create contract
      const contractId = await putFightContract({
        boxerId: gymBoxerId,
        opponentId,
        federationId: selectedEvent.federationId,
        weightClass: selectedGymBoxer.weightClass,
        guaranteedPayout: 0,
        ppvSplitPercentage: 0,
        ppvNetworkId: null,
        isTitleFight,
        status: 'accepted',
        counterOfferPayout: null,
        scheduledDate: selectedEvent.date,
        fightId: null,
      });

      // 2. Create fight
      const fightId = await putFight({
        date: selectedEvent.date,
        federationId: selectedEvent.federationId,
        weightClass: selectedGymBoxer.weightClass,
        boxerIds: [gymBoxerId, opponentId],
        winnerId: null,
        method: 'Decision',
        finishingMove: null,
        round: null,
        time: null,
        isTitleFight,
        contractId,
      });

      // 3. Re-put contract with fightId
      await putFightContract({
        id: contractId,
        boxerId: gymBoxerId,
        opponentId,
        federationId: selectedEvent.federationId,
        weightClass: selectedGymBoxer.weightClass,
        guaranteedPayout: 0,
        ppvSplitPercentage: 0,
        ppvNetworkId: null,
        isTitleFight,
        status: 'accepted',
        counterOfferPayout: null,
        scheduledDate: selectedEvent.date,
        fightId,
      });

      // 4. Calendar event for gym boxer
      await putCalendarEvent({ type: 'fight', date: selectedEvent.date, boxerIds: [gymBoxerId], fightId });

      // 5. Calendar event for opponent
      await putCalendarEvent({ type: 'fight', date: selectedEvent.date, boxerIds: [opponentId], fightId });

      // 6. Update federation event fights
      await updateFederationEventFights(eventId, fightId);

      // 7. Navigate
      navigate('/league/calendar');
    } finally {
      setConfirming(false);
    }
  }

  // Panel 1: boxer picker (when no boxer selected)
  if (selectedBoxerId === null) {
    return (
      <div className={styles.page}>
        <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Select a Boxer</div>
          {gymBoxers.length === 0 && (
            <p className={styles.empty}>No boxers on your roster.</p>
          )}
          {gymBoxers.map(boxer => {
            if (boxer.id === undefined) return null;
            const bid = boxer.id;
            const booked = bookedBoxerIds.has(bid);
            const injured = injuredBoxerIds.has(bid);
            const disabled = booked || injured;
            return (
              <div
                key={bid}
                className={`${styles.eventRow}${disabled ? ` ${styles.opponentRowBooked}` : ''}`}
                onClick={() => { if (!disabled) setSelectedBoxerId(bid); }}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) setSelectedBoxerId(bid); }}
              >
                <strong>{boxer.name}</strong>{' '}
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{boxer.weightClass}</span>{' '}
                <span style={{ fontSize: 12 }}>{calcRecord(boxer.record)}</span>
                {booked && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Fight scheduled</span>}
                {injured && !booked && <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 8 }}>Injured</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Panel 2: event + opponent selection
  return (
    <div className={styles.page}>
      <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
      <div style={{ marginBottom: 8 }}>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13 }}
          onClick={() => { setSelectedBoxerId(null); setSelectedEventId(null); setSelectedOpponentId(null); setIsTitleFight(false); }}
        >
          &larr; Back to boxer list
        </button>
        {selectedGymBoxer && (
          <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Scheduling for: <strong>{selectedGymBoxer.name}</strong> ({selectedGymBoxer.weightClass}, {calcRecord(selectedGymBoxer.record)})
          </span>
        )}
      </div>

      <div className={styles.panels}>
        {/* Left column: federation event slots */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Select an Event</div>
          {futureEvents.length === 0 && (
            <p className={styles.empty}>No upcoming events found.</p>
          )}
          {Array.from(eventsByFed.entries())
            .sort(([aId], [bId]) => aId - bId)
            .map(([fedId, events]) => {
              const fed = fedMap.get(fedId);
              return (
                <div key={fedId} className={styles.federationGroup}>
                  <div className={styles.federationGroupLabel}>
                    {fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
                  </div>
                  {events.map(ev => {
                    if (ev.id === undefined) return null;
                    const isSelected = selectedEventId === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className={`${styles.eventRow}${isSelected ? ` ${styles.eventRowSelected}` : ''}`}
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          setSelectedOpponentId(null);
                          setIsTitleFight(false);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedEventId(ev.id);
                            setSelectedOpponentId(null);
                            setIsTitleFight(false);
                          }
                        }}
                      >
                        <strong>{ev.name}</strong>{' '}
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatEventDate(ev.date)}</span>
                        {ev.fightIds.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                            {ev.fightIds.length} fight{ev.fightIds.length !== 1 ? 's' : ''} booked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>

        {/* Right column: opponents */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Select an Opponent</div>
          {!selectedEvent && (
            <p className={styles.empty}>Select an event first.</p>
          )}
          {selectedEvent && opponents.length === 0 && (
            <p className={styles.empty}>No available opponents for this weight class.</p>
          )}
          {selectedEvent && opponents.length > 0 && (
            <>
              {opponentsByFed.size === 0 && opponents.map(opp => {
                if (opp.id === undefined) return null;
                const oppId = opp.id;
                const booked = opponentsBookedForEvent.has(oppId);
                const isSelected = selectedOpponentId === oppId;
                const label = selectedGymBoxer ? matchupLabel(selectedGymBoxer.style, opp.style) : 'Neutral';
                return (
                  <OpponentRow
                    key={oppId}
                    boxer={opp}
                    gymBoxer={selectedGymBoxer}
                    label={label}
                    booked={booked}
                    isSelected={isSelected}
                    onSelect={() => { if (!booked) { setSelectedOpponentId(oppId); setIsTitleFight(false); } }}
                    styles={styles}
                  />
                );
              })}
              {opponentsByFed.size > 0 && Array.from(opponentsByFed.entries())
                .sort(([aId], [bId]) => aId - bId)
                .map(([fedId, opps]) => {
                  const fed = fedMap.get(fedId);
                  return (
                    <div key={fedId} className={styles.federationGroup}>
                      <div className={styles.federationGroupLabel}>
                        {fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
                      </div>
                      {opps.map(opp => {
                        if (opp.id === undefined) return null;
                        const oppId = opp.id;
                        const booked = opponentsBookedForEvent.has(oppId);
                        const isSelected = selectedOpponentId === oppId;
                        const label = selectedGymBoxer ? matchupLabel(selectedGymBoxer.style, opp.style) : 'Neutral';
                        return (
                          <OpponentRow
                            key={oppId}
                            boxer={opp}
                            gymBoxer={selectedGymBoxer}
                            label={label}
                            booked={booked}
                            isSelected={isSelected}
                            onSelect={() => { if (!booked) { setSelectedOpponentId(oppId); setIsTitleFight(false); } }}
                            styles={styles}
                          />
                        );
                      })}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </div>

      {/* Title fight checkbox + confirm */}
      <div className={styles.confirmRow}>
        {titleFightEligible && (
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={isTitleFight}
              onChange={e => setIsTitleFight(e.target.checked)}
            />
            Title fight
          </label>
        )}
        <button
          className={styles.confirmButton}
          disabled={!canConfirm || confirming}
          onClick={handleConfirm}
        >
          {confirming ? 'Scheduling...' : 'Confirm Fight'}
        </button>
      </div>
    </div>
  );
}

// --- Sub-component ---

interface OpponentRowProps {
  boxer: Boxer;
  gymBoxer: Boxer | null;
  label: 'Counters you' | 'Neutral' | 'You counter';
  booked: boolean;
  isSelected: boolean;
  onSelect: () => void;
  styles: Record<string, string>;
}

function OpponentRow({ boxer, gymBoxer, label, booked, isSelected, onSelect, styles }: OpponentRowProps) {
  const matchupClass =
    label === 'Counters you' ? styles.matchupCounter :
    label === 'You counter'  ? styles.matchupYou :
    styles.matchupNeutral;

  const rowClass = [
    styles.opponentRow,
    isSelected ? styles.opponentRowSelected : '',
    booked ? styles.opponentRowBooked : '',
  ].filter(Boolean).join(' ');

  const gymOff = gymBoxer ? statAvg(gymBoxer.stats, 'offense').toFixed(1) : '-';
  const gymDef = gymBoxer ? statAvg(gymBoxer.stats, 'defense').toFixed(1) : '-';
  const gymPhy = gymBoxer ? statAvg(gymBoxer.stats, 'physical').toFixed(1) : '-';
  const oppOff = statAvg(boxer.stats, 'offense').toFixed(1);
  const oppDef = statAvg(boxer.stats, 'defense').toFixed(1);
  const oppPhy = statAvg(boxer.stats, 'physical').toFixed(1);

  return (
    <div
      className={rowClass}
      onClick={onSelect}
      role="button"
      tabIndex={booked ? -1 : 0}
      onKeyDown={e => { if (!booked && (e.key === 'Enter' || e.key === ' ')) onSelect(); }}
    >
      <div>
        <strong>{boxer.name}</strong>{' '}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{boxer.reputation}</span>{' '}
        <span style={{ fontSize: 12 }}>{calcRecord(boxer.record)}</span>{' '}
        <span className={matchupClass}>{label}</span>
      </div>
      <div className={styles.statCompare}>
        Off: {gymOff} vs {oppOff} &nbsp;|&nbsp;
        Def: {gymDef} vs {oppDef} &nbsp;|&nbsp;
        Phy: {gymPhy} vs {oppPhy}
      </div>
    </div>
  );
}
