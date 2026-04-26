import type { Boxer, Fight, FightingStyle, FightMethod, FightRecord, ReputationLevel } from '../db/db';

export interface FightSimResult {
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
}

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

const STYLE_FOCUS: Record<FightingStyle, (keyof Boxer['stats'])[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

// STYLE_COUNTERS[x] = the style that counters x
const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer':      'swarmer',
  'swarmer':        'slugger',
  'slugger':        'counterpuncher',
  'counterpuncher': 'out-boxer',
};

const FINISH_MOVES: Record<FightingStyle, string[]> = {
  'out-boxer':      ['Jab', 'Cross', 'Right Cross'],
  'swarmer':        ['Lead Hook', 'Rear Hook', 'Body Shot'],
  'slugger':        ['Rear Hook', 'Uppercut', 'Overhand Right'],
  'counterpuncher': ['Counter Right', 'Counter Left Hook', 'Body Counter'],
};

const ALL_STATS: (keyof Boxer['stats'])[] = [
  'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
  'headMovement', 'bodyMovement', 'guard', 'positioning',
  'timing', 'adaptability', 'discipline',
  'speed', 'power', 'endurance', 'recovery', 'toughness',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function computeStatScore(boxer: Boxer): number {
  const focus = new Set(STYLE_FOCUS[boxer.style]);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const stat of ALL_STATS) {
    const weight = focus.has(stat) ? 2 : 1;
    weightedSum += boxer.stats[stat] * weight;
    totalWeight += weight;
  }
  return (weightedSum / totalWeight) / 20;
}

export function computeStyleScore(styleA: FightingStyle, styleB: FightingStyle): number {
  if (STYLE_COUNTERS[styleB] === styleA) return 1.0; // A counters B
  if (STYLE_COUNTERS[styleA] === styleB) return 0.0; // B counters A
  return 0.5;
}

export function computeRandomWeight(tierGap: number): number {
  return Math.max(0.01, 0.10 - tierGap * 0.01);
}

export function simulateFight(
  boxerA: Boxer,
  boxerB: Boxer,
  fight: Fight,
  federationName: string,
): FightSimResult {
  if (boxerA.id == null || boxerB.id == null) {
    throw new Error('simulateFight: both boxers must have a persisted id');
  }

  const statA = computeStatScore(boxerA);
  const statB = computeStatScore(boxerB);
  const styleScore = computeStyleScore(boxerA.style, boxerB.style);

  const tierGap = Math.abs(REPUTATION_INDEX[boxerA.reputation] - REPUTATION_INDEX[boxerB.reputation]);
  const randomWeight = computeRandomWeight(tierGap);

  // statRatio is the primary driver: A's stat share of the combined pool.
  // styleAdj shifts winProb up/down by up to ±10% based on style matchup.
  // randAdj adds a small continuous noise scaled by randomWeight (smaller at large tier gaps).
  const statRatio = (statA + statB) === 0 ? 0.5 : statA / (statA + statB);
  const styleAdj  = (styleScore - 0.5) * 0.20;
  const randAdj   = (Math.random() - 0.5) * randomWeight;

  const winProbA = Math.min(1, Math.max(0, statRatio + styleAdj + randAdj));
  const aWins    = Math.random() < winProbA;

  const winner = aWins ? boxerA : boxerB;
  const loser  = aWins ? boxerB : boxerA;
  const margin = Math.abs(winProbA - 0.5);

  let method: FightMethod;
  if (margin > 0.35)      method = 'KO';
  else if (margin > 0.20) method = 'TKO';
  else if (margin > 0.08) method = 'Split Decision';
  else                    method = 'Decision';

  const isFinish = method === 'KO' || method === 'TKO';

  const round = method === 'KO'  ? randInt(1, 6)
              : method === 'TKO' ? randInt(4, 10)
              : 12;

  const time = isFinish
    ? `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`
    : '3:00';

  const finishingMove = isFinish ? pick(FINISH_MOVES[winner.style]) : null;

  const winnerRecord: FightRecord = {
    result: 'win',
    opponentName: loser.name,
    opponentId: loser.id!,
    method,
    finishingMove,
    round,
    time,
    federation: federationName,
    date: fight.date,
  };

  const loserRecord: FightRecord = {
    result: 'loss',
    opponentName: winner.name,
    opponentId: winner.id!,
    method,
    finishingMove,
    round,
    time,
    federation: federationName,
    date: fight.date,
  };

  return {
    winnerId: winner.id!,
    loserId: loser.id!,
    method,
    finishingMove,
    round,
    time,
    winnerRecord,
    loserRecord,
  };
}
