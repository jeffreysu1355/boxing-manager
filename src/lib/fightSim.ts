import type { Boxer, Fight, FightingStyle, FightMethod, FightRecord, ReputationLevel } from '../db/db';
import type { StatCategory, RoundLogEntry } from '../db/db';
export type { StatCategory };
export type { RoundLogEntry };

export const STAT_CATEGORIES: Record<StatCategory, (keyof Boxer['stats'])[]> = {
  offense:  ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'],
  defense:  ['headMovement', 'bodyMovement', 'guard', 'positioning'],
  mental:   ['timing', 'adaptability', 'discipline'],
  physical: ['speed', 'power', 'endurance', 'recovery', 'toughness'],
};

export interface FightSimResult {
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
  roundLog?: RoundLogEntry[];
}

export interface FightState {
  round: number;
  playerHealth: number;
  opponentHealth: number;
  playerStamina: number;
  opponentStamina: number;
  playerScore: number;
  opponentScore: number;
  repeatCount: number;
  lastPlayerStat: keyof Boxer['stats'] | null;
  lastPlayerCategory: StatCategory | null;
  roundLog: RoundLogEntry[];
  finished: boolean;
  result?: Pick<FightSimResult, 'winnerId' | 'loserId' | 'method' | 'finishingMove' | 'round' | 'time'>;
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

export const STYLE_FOCUS: Record<FightingStyle, (keyof Boxer['stats'])[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

// STYLE_COUNTERS[x] = the style that counters x
export const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
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
    const weight = focus.has(stat) ? 3 : 0.5;
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

const STYLE_TO_CATEGORY: Record<FightingStyle, StatCategory> = {
  'out-boxer':      'offense',
  'swarmer':        'offense',
  'slugger':        'offense',
  'counterpuncher': 'mental',
};

export function pickOpponentChoice(
  opponent: Boxer,
): { category: StatCategory; stat: keyof Boxer['stats'] } {
  const category = STYLE_TO_CATEGORY[opponent.style];
  const statsInCategory = STAT_CATEGORIES[category];
  let bestStat = statsInCategory[0];
  let bestVal = opponent.stats[bestStat] as number;
  for (const s of statsInCategory) {
    const v = opponent.stats[s] as number;
    if (v > bestVal) { bestVal = v; bestStat = s; }
  }
  return { category, stat: bestStat };
}

const BASE_DRAIN = 12;
const DAMAGE_SCALE = 15;
const DEFENSE_SCALE = 0.5;

export function initFightState(): FightState {
  return {
    round: 1,
    playerHealth: 100,
    opponentHealth: 100,
    playerStamina: 100,
    opponentStamina: 100,
    playerScore: 0,
    opponentScore: 0,
    repeatCount: 0,
    lastPlayerStat: null,
    lastPlayerCategory: null,
    roundLog: [],
    finished: false,
  };
}

function staminaDrain(boxer: Boxer): number {
  const drain = BASE_DRAIN - (boxer.stats.endurance * 0.8 + boxer.stats.toughness * 0.4) / 2;
  return Math.min(15, Math.max(2, drain));
}

function staminaMultiplier(stamina: number): number {
  return 0.4 + 0.6 * (stamina / 100);
}

function effectiveStatScore(
  boxer: Boxer,
  stamina: number,
  category: StatCategory,
  spotlightStat: keyof Boxer['stats'],
): number {
  const mult = staminaMultiplier(stamina);
  const statsInCat = STAT_CATEGORIES[category];
  let sum = 0;
  let totalWeight = 0;
  for (const stat of statsInCat) {
    const weight = stat === spotlightStat ? 6 : 3;
    sum += (boxer.stats[stat] as number) * mult * weight;
    totalWeight += weight;
  }
  return (sum / totalWeight) / 20;
}

function defenseScore(boxer: Boxer, stamina: number): number {
  const mult = staminaMultiplier(stamina);
  return ((boxer.stats.guard as number) + (boxer.stats.headMovement as number)) / 2 * mult;
}

function generateNarrative(
  playerDmg: number,
  opponentDmg: number,
  penalty: number,
  spotlightStat: keyof Boxer['stats'],
  knockdown: boolean,
): string {
  const statLabel = (spotlightStat as string).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  let msg = '';
  if (playerDmg > opponentDmg + 5) {
    msg = `You dominated with your ${statLabel}.`;
  } else if (opponentDmg > playerDmg + 5) {
    msg = `Opponent took control — your ${statLabel} wasn't enough.`;
  } else {
    msg = `Competitive round — you focused on ${statLabel}.`;
  }
  if (penalty >= 0.20) msg += ` Opponent is adapting to your ${statLabel} (−${Math.round(penalty * 100)}%).`;
  if (knockdown) msg += ' Knockdown!';
  return msg;
}

export function simulateRound(
  state: FightState,
  player: Boxer,
  opponent: Boxer,
  choice: { category: StatCategory; stat: keyof Boxer['stats'] },
): FightState {
  if (state.finished) return state;

  const sameStatAsLast = state.lastPlayerStat === choice.stat;
  const newRepeatCount = sameStatAsLast ? state.repeatCount + 1 : 0;
  const penaltyRate = (opponent.stats.adaptability as number) >= 15 ? 0.15 : 0.10;
  const adaptationPenalty = Math.min(0.5, newRepeatCount * penaltyRate);

  const newPlayerStamina   = Math.max(0, state.playerStamina   - staminaDrain(player));
  const newOpponentStamina = Math.max(0, state.opponentStamina - staminaDrain(opponent));

  const opponentChoice = pickOpponentChoice(opponent);

  const playerAttack   = effectiveStatScore(player,   state.playerStamina,   choice.category,         choice.stat)          * (1 - adaptationPenalty);
  const opponentAttack = effectiveStatScore(opponent, state.opponentStamina, opponentChoice.category, opponentChoice.stat);

  const playerNetDmg   = Math.max(1, playerAttack   * DAMAGE_SCALE - defenseScore(opponent, state.opponentStamina) * DEFENSE_SCALE);
  const opponentNetDmg = Math.max(1, opponentAttack * DAMAGE_SCALE - defenseScore(player,   state.playerStamina)   * DEFENSE_SCALE);

  const newPlayerHealth   = Math.max(0, state.playerHealth   - opponentNetDmg);
  const newOpponentHealth = Math.max(0, state.opponentHealth - playerNetDmg);

  const dmgDiff = playerNetDmg - opponentNetDmg;
  const knockdownOccurred = Math.abs(dmgDiff) > 8;
  const playerRoundScore   = playerNetDmg >= opponentNetDmg ? 10 : (knockdownOccurred ? 8 : 9);
  const opponentRoundScore = opponentNetDmg > playerNetDmg  ? 10 : (knockdownOccurred ? 8 : 9);

  const narrative = generateNarrative(playerNetDmg, opponentNetDmg, adaptationPenalty, choice.stat, knockdownOccurred);

  const entry: RoundLogEntry = {
    round: state.round,
    playerFocus: choice,
    playerDamageDealt: Math.round(playerNetDmg * 10) / 10,
    opponentDamageDealt: Math.round(opponentNetDmg * 10) / 10,
    playerScoreThisRound: playerRoundScore,
    opponentScoreThisRound: opponentRoundScore,
    adaptationPenalty,
    knockdownOccurred,
    narrative,
  };

  const newPlayerScore   = state.playerScore   + playerRoundScore;
  const newOpponentScore = state.opponentScore + opponentRoundScore;
  const newRoundLog = [...state.roundLog, entry];
  const isLastRound = state.round === 12;

  let finished = false;
  let result: FightState['result'] | undefined;

  const playerKOd   = newPlayerHealth   <= 0;
  const opponentKOd = newOpponentHealth <= 0;

  if (playerKOd || opponentKOd) {
    finished = true;
    const playerWins = !playerKOd && opponentKOd;
    const winnerId = playerWins ? player.id! : opponent.id!;
    const loserId  = playerWins ? opponent.id! : player.id!;
    const winner   = playerWins ? player : opponent;
    result = {
      winnerId, loserId, method: 'KO',
      finishingMove: pick(FINISH_MOVES[winner.style]),
      round: state.round,
      time: `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`,
    };
  } else {
    const playerTKO   = newPlayerHealth   <= 15 && opponentNetDmg > playerNetDmg;
    const opponentTKO = newOpponentHealth <= 15 && playerNetDmg   > opponentNetDmg;

    if (playerTKO || opponentTKO) {
      finished = true;
      const playerWins = opponentTKO;
      const winnerId = playerWins ? player.id! : opponent.id!;
      const loserId  = playerWins ? opponent.id! : player.id!;
      const winner   = playerWins ? player : opponent;
      result = {
        winnerId, loserId, method: 'TKO',
        finishingMove: pick(FINISH_MOVES[winner.style]),
        round: state.round,
        time: `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`,
      };
    } else if (isLastRound) {
      finished = true;
      const playerWins = newPlayerScore >= newOpponentScore;
      const winnerId = playerWins ? player.id! : opponent.id!;
      const loserId  = playerWins ? opponent.id! : player.id!;
      const scoreDiff = Math.abs(newPlayerScore - newOpponentScore);
      const method: FightMethod = scoreDiff >= 4 ? 'Decision' : 'Split Decision';
      result = { winnerId, loserId, method, finishingMove: null, round: 12, time: '3:00' };
    }
  }

  return {
    round: state.round + 1,
    playerHealth:   newPlayerHealth,
    opponentHealth: newOpponentHealth,
    playerStamina:  newPlayerStamina,
    opponentStamina: newOpponentStamina,
    playerScore:   newPlayerScore,
    opponentScore: newOpponentScore,
    repeatCount:   newRepeatCount,
    lastPlayerStat: choice.stat,
    lastPlayerCategory: choice.category,
    roundLog: newRoundLog,
    finished,
    result,
  };
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

  // statDiff is the primary driver: absolute normalized stat gap, scaled so
  // that realistic elite-vs-unknown matchups produce ~2-5% win probability
  // for the underdog rather than the ~25% floor produced by a ratio approach.
  // k=0.85 means a full stat gap (1.0 vs 0.0) guarantees a win; equal stats
  // give exactly 0.5; Tai (0.31) vs Michael (0.89) gives ~3%.
  const statDiff  = statA - statB;
  const styleAdj  = (styleScore - 0.5) * 0.20;
  const randAdj   = (Math.random() - 0.5) * randomWeight;

  const winProbA = Math.min(1, Math.max(0, 0.5 + statDiff * 0.85 + styleAdj + randAdj));
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
    isTitleFight: fight.isTitleFight,
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
    isTitleFight: fight.isTitleFight,
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
