import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { BoxerStats, FederationName, FightingStyle, FightRecord, ReputationLevel } from '../../db/db';

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

// --- Component stub ---

export default function Schedule() {
  return (
    <div>
      <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
      <p>Schedule will display here.</p>
    </div>
  );
}
