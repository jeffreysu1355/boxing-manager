import type { Boxer, ReputationLevel } from '../db/db';

export const REPUTATION_ORDER: ReputationLevel[] = [
  'Unknown',
  'Local Star',
  'Rising Star',
  'Respectable Opponent',
  'Contender',
  'Championship Caliber',
  'Nationally Ranked',
  'World Class Fighter',
  'International Superstar',
  'All-Time Great',
];

export const RANK_CONFIG: Record<ReputationLevel, {
  promotionThreshold: number;
  bufferMax: number;
  baseWinPoints: number;
}> = {
  'Unknown':                 { promotionThreshold: 20,       bufferMax: 10, baseWinPoints: 6  },
  'Local Star':              { promotionThreshold: 30,       bufferMax: 15, baseWinPoints: 8  },
  'Rising Star':             { promotionThreshold: 40,       bufferMax: 20, baseWinPoints: 10 },
  'Respectable Opponent':    { promotionThreshold: 55,       bufferMax: 25, baseWinPoints: 13 },
  'Contender':               { promotionThreshold: 70,       bufferMax: 30, baseWinPoints: 17 },
  'Championship Caliber':    { promotionThreshold: 85,       bufferMax: 35, baseWinPoints: 20 },
  'Nationally Ranked':       { promotionThreshold: 100,      bufferMax: 40, baseWinPoints: 23 },
  'World Class Fighter':     { promotionThreshold: 120,      bufferMax: 45, baseWinPoints: 27 },
  'International Superstar': { promotionThreshold: 150,      bufferMax: 50, baseWinPoints: 32 },
  'All-Time Great':          { promotionThreshold: Infinity, bufferMax: 50, baseWinPoints: 32 },
};

const WIN_MULTIPLIERS: [number, number][] = [
  [2,  1.5],
  [1,  1.25],
  [0,  1.0],
  [-1, 0.4],
  [-Infinity, 0.1],
];

const LOSS_MULTIPLIERS: [number, number][] = [
  [2,  0.3],
  [1,  0.45],
  [0,  0.6],
  [-1, 0.9],
  [-Infinity, 1.2],
];

function getMultiplier(gap: number, table: [number, number][]): number {
  for (const [threshold, mult] of table) {
    if (gap >= threshold) return mult;
  }
  return table[table.length - 1][1];
}

export function applyRankChange(
  boxer: Boxer,
  opponent: Boxer,
  result: 'win' | 'loss' | 'draw',
  isTitleFight: boolean,
): Boxer {
  if (result === 'draw') return boxer;

  const boxerIndex = REPUTATION_ORDER.indexOf(boxer.reputation);
  const opponentIndex = REPUTATION_ORDER.indexOf(opponent.reputation);
  const gap = opponentIndex - boxerIndex;

  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;

  if (result === 'win') {
    const multiplier = isTitleFight ? 2.0 : getMultiplier(gap, WIN_MULTIPLIERS);
    const earned = Math.max(0, Math.round(config.baseWinPoints * multiplier));
    const newRankPoints = rankPoints + earned;

    if (newRankPoints >= config.promotionThreshold) {
      const nextRep = REPUTATION_ORDER[boxerIndex + 1];
      if (!nextRep) {
        return {
          ...boxer,
          rankPoints: newRankPoints,
          lastRankDelta: { points: earned, bufferPoints: 0, promoted: false, demoted: false },
        };
      }
      return {
        ...boxer,
        reputation: nextRep,
        rankPoints: 0,
        demotionBuffer: RANK_CONFIG[nextRep].bufferMax,
        lastRankDelta: { points: earned, bufferPoints: 0, promoted: true, demoted: false },
      };
    }

    return {
      ...boxer,
      rankPoints: newRankPoints,
      lastRankDelta: { points: earned, bufferPoints: 0, promoted: false, demoted: false },
    };
  }

  // Loss
  if (isTitleFight) {
    return {
      ...boxer,
      lastRankDelta: { points: 0, bufferPoints: 0, promoted: false, demoted: false },
    };
  }

  const multiplier = getMultiplier(gap, LOSS_MULTIPLIERS);
  const lost = Math.round(config.baseWinPoints * 0.6 * multiplier);

  const newBuffer = Math.max(0, demotionBuffer - lost);
  const bufferDrained = demotionBuffer - newBuffer;
  const overflow = lost - bufferDrained;
  const newRankPoints = Math.max(0, rankPoints - Math.max(0, overflow));

  if (newRankPoints <= 0 && newBuffer <= 0 && boxerIndex > 0) {
    const prevRep = REPUTATION_ORDER[boxerIndex - 1];
    const prevConfig = RANK_CONFIG[prevRep];
    return {
      ...boxer,
      reputation: prevRep,
      rankPoints: Math.floor(prevConfig.promotionThreshold * 0.7),
      demotionBuffer: prevConfig.bufferMax,
      lastRankDelta: { points: lost, bufferPoints: bufferDrained, promoted: false, demoted: true },
    };
  }

  return {
    ...boxer,
    rankPoints: newRankPoints,
    demotionBuffer: newBuffer,
    lastRankDelta: { points: lost, bufferPoints: bufferDrained, promoted: false, demoted: false },
  };
}
