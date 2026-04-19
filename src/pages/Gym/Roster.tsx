import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord, FederationName } from '../../db/db';

// --- Constants ---

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Exported helpers ---

export interface BoxerStatus {
  label: string;
  color: string;
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string
): BoxerStatus {
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date > today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    return { label: 'In Training Camp', color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
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

// --- Component stub ---

export default function Roster() {
  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <p>Roster will display here.</p>
    </div>
  );
}
