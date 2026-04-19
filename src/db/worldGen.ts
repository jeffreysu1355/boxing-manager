import namesData from '../data/names.json';
import { getBoxer, putBoxer } from './boxerStore';
import { putFederation } from './federationStore';
import { putTitle } from './titleStore';
import type {
  Boxer,
  BoxerStats,
  Federation,
  FederationName,
  FightingStyle,
  FightRecord,
  NaturalTalent,
  ReputationLevel,
  Title,
} from './db';

// --- RNG helpers ---

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [item, w] of entries) {
    r -= w;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

// --- Name generation ---

const FEDERATION_COUNTRIES: Record<FederationName, string[]> = {
  'North America Boxing Federation': ['USA', 'Canada', 'Mexico', 'Dominican Republic', 'Puerto Rico'],
  'South America Boxing Federation': ['Brazil', 'Argentina', 'Colombia', 'Venezuela', 'Uruguay', 'Panama'],
  'African Boxing Federation': ['Nigeria', 'South Africa', 'Ghana', 'Ethiopia', 'Kenya', 'Morocco'],
  'European Boxing Federation': ['England', 'France', 'Germany', 'Russia', 'Ukraine', 'Spain', 'Italy'],
  'Asia Boxing Federation': ['Japan', 'South Korea', 'Philippines', 'Thailand', 'Kazakhstan', 'Uzbekistan'],
  'Oceania Boxing Federation': ['Australia', 'New Zealand', 'Samoa', 'Papua New Guinea'],
  'International Boxing Federation': [
    'USA', 'Brazil', 'England', 'Japan', 'Nigeria', 'Australia', 'Mexico', 'France', 'Russia', 'Philippines',
  ],
};

type CountryData = { first: Record<string, number>; last: Record<string, number> };
const countries = (namesData as { countries: Record<string, CountryData> }).countries;

function generateName(fedName: FederationName): string {
  const pool = FEDERATION_COUNTRIES[fedName];
  const country = pick(pool.filter(c => countries[c]));
  const data = countries[country];

  const firstEntries = Object.entries(data.first) as [string, number][];
  const lastEntries = Object.entries(data.last) as [string, number][];

  const first = weightedPick(firstEntries);
  const last = weightedPick(lastEntries);
  return `${first} ${last}`;
}

// --- Stats generation ---

const STAT_RANGE: Record<ReputationLevel, { min: number; max: number }> = {
  'Unknown':               { min: 2,  max: 8  },
  'Local Star':            { min: 4,  max: 10 },
  'Rising Star':           { min: 6,  max: 12 },
  'Respectable Opponent':  { min: 8,  max: 13 },
  'Contender':             { min: 9,  max: 14 },
  'Championship Caliber':  { min: 11, max: 16 },
  'Nationally Ranked':     { min: 13, max: 17 },
  'World Class Fighter':   { min: 14, max: 18 },
  'International Superstar': { min: 15, max: 19 },
  'All-Time Great':        { min: 17, max: 20 },
};

const STYLE_FOCUS: Record<FightingStyle, (keyof BoxerStats)[]> = {
  'out-boxer':       ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':         ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':         ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher':  ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

const ALL_STATS: (keyof BoxerStats)[] = [
  'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
  'headMovement', 'bodyMovement', 'guard', 'positioning',
  'timing', 'adaptability', 'discipline',
  'speed', 'power', 'endurance', 'recovery', 'toughness',
];

function generateStats(reputation: ReputationLevel, style: FightingStyle): BoxerStats {
  const { min, max } = STAT_RANGE[reputation];
  const focused = new Set(STYLE_FOCUS[style]);
  const stats = {} as BoxerStats;

  for (const stat of ALL_STATS) {
    if (focused.has(stat)) {
      // Focus stats skew toward the top of the range
      stats[stat] = rand(Math.floor((min + max) / 2), Math.min(max + 2, 20));
    } else {
      stats[stat] = rand(min, max);
    }
  }

  return stats;
}

// --- Natural talents ---

function generateNaturalTalents(style: FightingStyle): NaturalTalent[] {
  if (Math.random() > 0.25) return [];
  const focused = STYLE_FOCUS[style];
  const stat = pick(focused);
  return [{ stat }];
}

// --- Fight record generation ---

const FIGHTING_STYLES: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];
const FINISH_MOVES: Record<FightingStyle, string[]> = {
  'out-boxer':      ['Jab', 'Cross', 'Right Cross'],
  'swarmer':        ['Lead Hook', 'Rear Hook', 'Body Shot'],
  'slugger':        ['Rear Hook', 'Uppercut', 'Overhand Right'],
  'counterpuncher': ['Counter Right', 'Counter Left Hook', 'Body Counter'],
};
const FIGHT_METHODS = ['KO', 'TKO', 'Decision', 'Split Decision'] as const;
const FEDERATION_NAMES: FederationName[] = [
  'North America Boxing Federation',
  'South America Boxing Federation',
  'African Boxing Federation',
  'European Boxing Federation',
  'Asia Boxing Federation',
  'Oceania Boxing Federation',
  'International Boxing Federation',
];

const RECORD_COUNTS: Record<ReputationLevel, { min: number; max: number; winRate: number }> = {
  'Unknown':               { min: 0,  max: 4,  winRate: 0.50 },
  'Local Star':            { min: 3,  max: 8,  winRate: 0.65 },
  'Rising Star':           { min: 5,  max: 12, winRate: 0.75 },
  'Respectable Opponent':  { min: 8,  max: 18, winRate: 0.65 },
  'Contender':             { min: 12, max: 25, winRate: 0.75 },
  'Championship Caliber':  { min: 15, max: 30, winRate: 0.80 },
  'Nationally Ranked':     { min: 18, max: 35, winRate: 0.83 },
  'World Class Fighter':   { min: 20, max: 40, winRate: 0.87 },
  'International Superstar': { min: 25, max: 45, winRate: 0.90 },
  'All-Time Great':        { min: 30, max: 50, winRate: 0.94 },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function generateFightRecord(reputation: ReputationLevel, style: FightingStyle): FightRecord[] {
  const { min, max, winRate } = RECORD_COUNTS[reputation];
  const total = rand(min, max);
  const records: FightRecord[] = [];

  let year = 2026 - Math.ceil(total / 4);
  let month = rand(1, 12);

  for (let i = 0; i < total; i++) {
    const isWin = Math.random() < winRate;
    const method = pick([...FIGHT_METHODS]);
    const isDecision = method === 'Decision' || method === 'Split Decision';
    const round = isDecision ? 12 : rand(1, 12);
    const mins = rand(0, 2);
    const secs = rand(0, 59).toString().padStart(2, '0');
    const time = `${mins}:${secs}`;
    const federation = pick(FEDERATION_NAMES);
    const dateStr = `${MONTHS[month - 1]} ${rand(1, 28)} ${year}`;

    records.push({
      result: isWin ? 'win' : 'loss',
      opponentName: generateName(federation),
      method,
      finishingMove: isDecision ? null : pick(FINISH_MOVES[style]),
      round,
      time: isDecision ? '3:00' : time,
      federation,
      date: dateStr,
    });

    month += rand(2, 4);
    while (month > 12) { month -= 12; year++; }
  }

  return records;
}

// --- Reputation distribution ---

// Per-federation distribution of 10 welterweight fighters.
// IBF skews higher; others follow standard pyramid.
const STANDARD_DISTRIBUTION: ReputationLevel[] = [
  'World Class Fighter',
  'Nationally Ranked',
  'Championship Caliber',
  'Contender',
  'Contender',
  'Respectable Opponent',
  'Respectable Opponent',
  'Rising Star',
  'Local Star',
  'Unknown',
];

const IBF_DISTRIBUTION: ReputationLevel[] = [
  'All-Time Great',
  'International Superstar',
  'World Class Fighter',
  'Nationally Ranked',
  'Championship Caliber',
  'Championship Caliber',
  'Contender',
  'Contender',
  'Respectable Opponent',
  'Rising Star',
];

// Occasionally add an International Superstar to non-IBF federations
function getDistribution(fedName: FederationName): ReputationLevel[] {
  if (fedName === 'International Boxing Federation') return [...IBF_DISTRIBUTION];
  const dist = [...STANDARD_DISTRIBUTION];
  if (Math.random() < 0.4) {
    // Replace a Nationally Ranked with an International Superstar
    const idx = dist.indexOf('Nationally Ranked');
    if (idx !== -1) dist[idx] = 'International Superstar';
  }
  return dist;
}

// Champion must be Championship Caliber or higher
const CHAMPION_ELIGIBLE: ReputationLevel[] = [
  'Championship Caliber',
  'Nationally Ranked',
  'World Class Fighter',
  'International Superstar',
  'All-Time Great',
];

// --- Federation seed data ---

const FEDERATION_PRESTIGE: Record<FederationName, number> = {
  'North America Boxing Federation': 8,
  'South America Boxing Federation': 6,
  'African Boxing Federation':       5,
  'European Boxing Federation':      7,
  'Asia Boxing Federation':          6,
  'Oceania Boxing Federation':       4,
  'International Boxing Federation': 10,
};

// --- Main world gen ---

export async function generateWorld(): Promise<void> {
  // 1. Seed federations
  const federationIds: Record<FederationName, number> = {} as Record<FederationName, number>;
  for (const name of FEDERATION_NAMES) {
    const fed: Omit<Federation, 'id'> = { name, prestige: FEDERATION_PRESTIGE[name] };
    const id = await putFederation(fed);
    federationIds[name] = id;
  }

  // 2. Generate welterweight fighters per federation and assign titles
  for (const fedName of FEDERATION_NAMES) {
    const fedId = federationIds[fedName];
    const distribution = getDistribution(fedName);

    // Shuffle distribution so champion position is random
    const shuffled = distribution.sort(() => Math.random() - 0.5);

    const boxerIds: number[] = [];
    let championId: number | null = null;

    for (const reputation of shuffled) {
      const style = pick(FIGHTING_STYLES);
      const boxer: Omit<Boxer, 'id'> = {
        name: generateName(fedName),
        age: rand(18, 36),
        weightClass: 'welterweight',
        style,
        reputation,
        gymId: null,
        stats: generateStats(reputation, style),
        naturalTalents: generateNaturalTalents(style),
        injuries: [],
        titles: [],
        record: generateFightRecord(reputation, style),
      };

      const boxerId = await putBoxer(boxer);
      boxerIds.push(boxerId);

      // Pick first eligible fighter encountered as champion
      if (
        championId === null &&
        CHAMPION_ELIGIBLE.includes(reputation) &&
        Math.random() < 0.5
      ) {
        championId = boxerId;
      }
    }

    // Ensure we have a champion if none was selected
    if (championId === null) {
      const eligible = boxerIds.filter((_, i) => CHAMPION_ELIGIBLE.includes(shuffled[i]));
      if (eligible.length > 0) {
        championId = pick(eligible);
      }
    }

    // 3. Create welterweight title for this federation
    const title: Omit<Title, 'id'> = {
      federationId: fedId,
      weightClass: 'welterweight',
      currentChampionId: championId,
      reigns: championId
        ? [{ boxerId: championId, dateWon: '2025-01-15', dateLost: null, defenseCount: rand(0, 4) }]
        : [],
    };
    const titleId = await putTitle(title);

    // 4. Update champion's boxer record with title
    if (championId !== null) {
      // We can't easily update a boxer we just inserted without re-fetching,
      // so we store the titleId on the boxer via a second put.
      const champ = await getBoxer(championId);
      if (champ) {
        champ.titles.push({ titleId, dateWon: '2025-01-15', dateLost: null });
        await putBoxer(champ);
      }
    }
  }
}
