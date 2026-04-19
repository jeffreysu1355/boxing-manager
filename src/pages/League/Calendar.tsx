import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { CalendarEvent, Fight, Federation, FederationName } from '../../db/db';

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

// --- Types ---

export interface CalendarRow {
  eventId: number;
  date: string;
  gymBoxerId: number;
  opponentId: number | undefined;
  federationAbbr: string;
  isTitleFight: boolean;
}

// --- Exported helpers ---

export function deriveRows(
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  gymBoxerIds: Set<number>,
  federationsMap: Map<number, Federation>,
  today: string
): CalendarRow[] {
  const rows: CalendarRow[] = [];

  for (const event of events) {
    if (event.type !== 'fight') continue;
    if (event.date < today) continue;

    const gymBoxerId = event.boxerIds.find(id => gymBoxerIds.has(id));
    if (gymBoxerId === undefined) continue;

    const fight = fightsMap.get(event.fightId);
    if (!fight) continue;

    if (event.id === undefined) continue;
    const opponentId = fight.boxerIds.find(id => id !== gymBoxerId);

    const federation = federationsMap.get(fight.federationId);
    const federationAbbr = federation
      ? (FEDERATION_ABBR[federation.name] ?? federation.name)
      : '?';

    rows.push({
      eventId: event.id,
      date: event.date,
      gymBoxerId,
      opponentId,
      federationAbbr,
      isTitleFight: fight.isTitleFight,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component stub ---

export default function Calendar() {
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
      <p>Calendar will display here.</p>
    </div>
  );
}
