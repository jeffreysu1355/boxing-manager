import namesData from '../data/names.json';
import { getBoxer, getAllBoxers, putBoxer, deleteBoxer } from './boxerStore';
import { putCoach } from './coachStore';
import { addDays } from '../lib/simTime';
import { putFederation } from './federationStore';
import { putFederationEvent } from './federationEventStore';
import { getGym, saveGym } from './gymStore';
import { putPpvNetwork } from './ppvNetworkStore';
import { putTitle } from './titleStore';
import { RANK_CONFIG } from '../lib/rankSystem';
import type {
  Boxer,
  BoxerStats,
  Coach,
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

function generateFightRecord(reputation: ReputationLevel, style: FightingStyle, age: number): FightRecord[] {
  const { min, max, winRate } = RECORD_COUNTS[reputation];
  const total = rand(min, max);
  const records: FightRecord[] = [];

  const earliestYear = 2026 - (age - 18); // can't have fought before turning 18
  let year = Math.max(earliestYear, 2026 - Math.ceil(total / 4));
  let month = rand(1, 12);

  for (let i = 0; i < total; i++) {
    // Stop generating once we've reached the game start year
    if (year >= 2026) break;

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
      opponentId: null,
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

const FEDERATION_ABBR_MAP: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

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

// --- PPV Network seed data ---

const PPV_NETWORK_NAMES: Record<FederationName, string[]> = {
  'North America Boxing Federation': [
    'NABF Sports', 'NABF Fight Night', 'America Boxing Live',
    'North America Championship Boxing', 'Prime Sports PPV', 'NABF Elite PPV',
  ],
  'South America Boxing Federation': [
    'SABF Sports', 'SABF Fight Night', 'South America Boxing Live',
    'Copa Boxing Network', 'Latin Premium PPV', 'SABF Elite PPV',
  ],
  'African Boxing Federation': [
    'ABF Sports', 'ABF Fight Night', 'Africa Boxing Live',
    'Pan-Africa Boxing Network', 'African Championship PPV', 'ABF Elite PPV',
  ],
  'European Boxing Federation': [
    'EBF Sports', 'European Fight Night', 'Euro Boxing Live',
    'Continental Championship Boxing', 'European Premium PPV', 'EBF Elite PPV',
  ],
  'Asia Boxing Federation': [
    'AsBF Sports', 'AsBF Fight Night', 'Asia Boxing Live',
    'Pan-Asia Championship Boxing', 'Asia Premium PPV', 'AsBF Elite PPV',
  ],
  'Oceania Boxing Federation': [
    'OBF Sports', 'OBF Fight Night', 'Pacific Boxing Live',
    'Oceania Championship Boxing', 'Pacific Premium PPV', 'OBF Elite PPV',
  ],
  'International Boxing Federation': [
    'IBF Sports', 'IBF Fight Night', 'World Boxing Live',
    'International Championship Boxing', 'World Premium PPV', 'IBF Elite Network', 'IBF World Championship PPV',
  ],
};

interface PpvNetworkTier {
  minBoxerRank: number;
  baseViewershipMin: number;
  baseViewershipMax: number;
  titleFightMultiplierMin: number;
  titleFightMultiplierMax: number;
}

const STANDARD_PPV_TIERS: PpvNetworkTier[] = [
  { minBoxerRank: 0, baseViewershipMin: 50_000,    baseViewershipMax: 200_000,  titleFightMultiplierMin: 1.2, titleFightMultiplierMax: 1.3 },
  { minBoxerRank: 0, baseViewershipMin: 50_000,    baseViewershipMax: 200_000,  titleFightMultiplierMin: 1.2, titleFightMultiplierMax: 1.3 },
  { minBoxerRank: 3, baseViewershipMin: 300_000,   baseViewershipMax: 800_000,  titleFightMultiplierMin: 1.3, titleFightMultiplierMax: 1.5 },
  { minBoxerRank: 3, baseViewershipMin: 300_000,   baseViewershipMax: 800_000,  titleFightMultiplierMin: 1.3, titleFightMultiplierMax: 1.5 },
  { minBoxerRank: 5, baseViewershipMin: 1_000_000, baseViewershipMax: 3_000_000, titleFightMultiplierMin: 1.5, titleFightMultiplierMax: 1.6 },
  { minBoxerRank: 7, baseViewershipMin: 5_000_000, baseViewershipMax: 15_000_000, titleFightMultiplierMin: 1.6, titleFightMultiplierMax: 1.8 },
];

const IBF_EXTRA_TIER: PpvNetworkTier = {
  minBoxerRank: 8,
  baseViewershipMin: 20_000_000,
  baseViewershipMax: 50_000_000,
  titleFightMultiplierMin: 1.8,
  titleFightMultiplierMax: 2.0,
};

// --- Prospect / Free Agent pool generation ---

const FREE_AGENT_REPUTATION_DISTRIBUTION: [ReputationLevel, number][] = [
  ['Unknown',              60],
  ['Local Star',           30],
  ['Rising Star',           8],
  ['Respectable Opponent',  1.5],
  ['Contender',             0.5],
];

function generateAmateurRecord(style: FightingStyle): FightRecord[] {
  const total = rand(0, 5);
  const records: FightRecord[] = [];
  let year = 2026 - Math.ceil(total / 3);
  let month = rand(1, 12);

  for (let i = 0; i < total; i++) {
    if (year >= 2026) break;

    const isWin = Math.random() < 0.55;
    const method = pick(['Decision', 'TKO', 'KO'] as const);
    const isDecision = method === 'Decision';
    const round = isDecision ? 4 : rand(1, 4);
    const mins = rand(0, 2);
    const secs = rand(0, 59).toString().padStart(2, '0');
    const dateStr = `${MONTHS[month - 1]} ${rand(1, 28)} ${year}`;

    records.push({
      result: isWin ? 'win' : 'loss',
      opponentName: generateName('North America Boxing Federation'),
      opponentId: null,
      method,
      finishingMove: isDecision ? null : pick(FINISH_MOVES[style]),
      round,
      time: isDecision ? '3:00' : `${mins}:${secs}`,
      federation: 'Amateur',
      date: dateStr,
    });

    month += rand(2, 5);
    while (month > 12) { month -= 12; year++; }
  }

  return records;
}

export async function generateProspects(): Promise<void> {
  const count = rand(13, 17);
  for (let i = 0; i < count; i++) {
    const style = pick(FIGHTING_STYLES);
    const reputation = 'Unknown' as const;
    const fedName = pick(FEDERATION_NAMES);
    const prospect: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age: rand(14, 17),
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateAmateurRecord(style),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
      nextFightDate: addDays('2026-01-01', rand(0, 180)),
    };
    await putBoxer(prospect);
  }
}

export async function generateFreeAgents(): Promise<void> {
  const count = rand(23, 27);
  for (let i = 0; i < count; i++) {
    const style = pick(FIGHTING_STYLES);
    const reputation = weightedPick(FREE_AGENT_REPUTATION_DISTRIBUTION);
    const fedName = pick(FEDERATION_NAMES);
    const age = rand(22, 35);
    const freeAgent: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age,
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateFightRecord(reputation, style, age),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
      nextFightDate: addDays('2026-01-01', rand(0, 180)),
    };
    await putBoxer(freeAgent);
  }
}

// --- Coach generation ---

async function generateCoaches(): Promise<number[]> {
  const styles: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];

  // Distribute 10 local coaches across 4 styles: 3 + 3 + 2 + 2
  const localStyleAssignments: FightingStyle[] = [
    ...Array(3).fill(styles[0]),
    ...Array(3).fill(styles[1]),
    ...Array(2).fill(styles[2]),
    ...Array(2).fill(styles[3]),
  ];
  // Shuffle so it's not always the same order
  localStyleAssignments.sort(() => Math.random() - 0.5);

  const coachIds: number[] = [];

  for (const style of localStyleAssignments) {
    const coach: Omit<Coach, 'id'> = {
      name: generateName(pick(FEDERATION_NAMES)),
      skillLevel: 'local',
      style,
      assignedBoxerId: null,
    };
    const id = await putCoach(coach);
    coachIds.push(id);
  }

  // 1 contender coach with random style
  const contender: Omit<Coach, 'id'> = {
    name: generateName(pick(FEDERATION_NAMES)),
    skillLevel: 'contender',
    style: pick(styles),
    assignedBoxerId: null,
  };
  const contenderId = await putCoach(contender);
  coachIds.push(contenderId);

  return coachIds;
}

async function generatePpvNetworks(
  federationIds: Record<FederationName, number>
): Promise<void> {
  for (const fedName of FEDERATION_NAMES) {
    const fedId = federationIds[fedName];
    const names = PPV_NETWORK_NAMES[fedName];
    const tiers = fedName === 'International Boxing Federation'
      ? [...STANDARD_PPV_TIERS, IBF_EXTRA_TIER]
      : STANDARD_PPV_TIERS;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const baseViewership = rand(tier.baseViewershipMin, tier.baseViewershipMax);
      const titleFightMultiplier = parseFloat(
        (tier.titleFightMultiplierMin + Math.random() * (tier.titleFightMultiplierMax - tier.titleFightMultiplierMin)).toFixed(2)
      );
      await putPpvNetwork({
        name: names[i] ?? `${fedName} Network ${i + 1}`,
        federationId: fedId,
        minBoxerRank: tier.minBoxerRank,
        baseViewership,
        titleFightMultiplier,
      });
    }
  }
}

// Quarter week offsets: weeks 10, 23, 36, 49 (roughly Mar, Jun, Sep, Dec)
const QUARTER_WEEKS = [10, 23, 36, 49];

export async function generateFederationEvents(
  year: number,
  federationIds: { id: number; name: FederationName }[]
): Promise<void> {
  for (const fed of federationIds) {
    const abbr = FEDERATION_ABBR_MAP[fed.name];
    // Deterministic stagger per federation (0–6 days) so events don't all land on the same day
    const stagger = Math.floor(Math.abs(fed.id * 13) % 7);

    for (const week of QUARTER_WEEKS) {
      const dayOfYear = week * 7 + stagger;
      const date = new Date(year, 0, dayOfYear);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${d}`;
      const monthName = MONTHS[date.getMonth()];
      const name = `${abbr} ${monthName} ${year}`;

      await putFederationEvent({
        federationId: fed.id,
        date: isoDate,
        name,
        fightIds: [],
      });
    }
  }
}

// --- Cross-reference fights ---

export async function crossReferenceFights(
  federationId: number,
  boxerIds: number[],
  probability = 0.4,
): Promise<void> {
  const boxers = await Promise.all(boxerIds.map(id => getBoxer(id)));
  const realBoxers = boxers.filter((b): b is Boxer => b !== undefined);

  // Track which pairs have already been linked: "minId-maxId"
  const paired = new Set<string>();

  for (const boxerA of realBoxers) {
    if (boxerA.id === undefined) continue;
    let aModified = false;

    for (let i = 0; i < boxerA.record.length; i++) {
      const fight = boxerA.record[i];
      // Mirror records pushed onto boxerB (below) have opponentId set, so they
      // are safely skipped when boxerB is later visited as boxerA in this loop.
      if (fight.opponentId !== null) continue;
      if (Math.random() >= probability) continue;

      const eligible = realBoxers.filter(b => {
        if (b.id === undefined || b.id === boxerA.id) return false;
        if (b.federationId !== federationId) return false;
        if (b.weightClass !== boxerA.weightClass) return false;
        const key = [Math.min(boxerA.id!, b.id), Math.max(boxerA.id!, b.id)].join('-');
        return !paired.has(key);
      });

      if (eligible.length === 0) continue;

      const boxerB = eligible[Math.floor(Math.random() * eligible.length)];
      const pairKey = [Math.min(boxerA.id!, boxerB.id!), Math.max(boxerA.id!, boxerB.id!)].join('-');
      paired.add(pairKey);

      boxerA.record[i] = {
        ...fight,
        opponentName: boxerB.name,
        opponentId: boxerB.id!,
      };
      aModified = true;

      const mirrorResult: FightRecord['result'] =
        fight.result === 'win' ? 'loss' :
        fight.result === 'loss' ? 'win' :
        'draw';

      boxerB.record.push({
        ...fight,
        result: mirrorResult,
        opponentName: boxerA.name,
        opponentId: boxerA.id!,
      });
      await putBoxer(boxerB);
    }

    if (aModified) await putBoxer(boxerA);
  }
}

// --- Recruit pool refresh ---

export async function refreshRecruitPool(): Promise<void> {
  const all = await getAllBoxers();
  const pool = all.filter(b => b.gymId === null && b.federationId === null && b.id !== undefined);
  await Promise.all(pool.map(b => deleteBoxer(b.id!)));
  await generateProspects();
  await generateFreeAgents();
}

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
      const age = rand(18, 36);
      const boxer: Omit<Boxer, 'id'> = {
        name: generateName(fedName),
        age,
        weightClass: 'welterweight',
        style,
        reputation,
        gymId: null,
        federationId: fedId,
        stats: generateStats(reputation, style),
        naturalTalents: generateNaturalTalents(style),
        injuries: [],
        titles: [],
        record: generateFightRecord(reputation, style, age),
        rankPoints: 0,
        demotionBuffer: RANK_CONFIG[reputation].bufferMax,
        nextFightDate: addDays('2026-01-01', rand(0, 180)),
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

    // 5. Cross-reference fights between real boxers in this federation
    await crossReferenceFights(fedId, boxerIds);
  }

  // 5. Generate recruiting pool (prospects + free agents)
  await generateProspects();
  await generateFreeAgents();

  // 6. Create player gym
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    coachIds: [],
    currentDate: '2026-01-01',
  });

  // 7. Seed coaches and update gym
  const coachIds = await generateCoaches();
  const gym = await getGym();
  if (gym) {
    await saveGym({ ...gym, coachIds });
  }

  // 8. Seed PPV networks per federation
  await generatePpvNetworks(federationIds);

  // 9. Generate federation event slots for current year
  const currentYear = new Date().getFullYear();
  const fedList = (Object.entries(federationIds) as [FederationName, number][]).map(
    ([name, id]) => ({ id, name })
  );
  await generateFederationEvents(currentYear, fedList);
}
