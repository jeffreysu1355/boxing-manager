import type { FightRecord } from '../db/db';

export const PPV_REVENUE_PER_VIEWER = 0.50;

const WIN_RATE_NEUTRAL = 0.5;   // geo mean at or below this = no bonus
const RECORD_SLOPE = 0.8;       // multiplier per unit above neutral
const RECORD_MAX_BONUS = 0.4;   // caps record multiplier at 1.4×

const STREAK_MAX_LENGTH = 5;    // streaks longer than this get no extra credit
const STREAK_MAX_BONUS = 0.15;  // max multiplier bonus when both fighters have max streaks

export function calcRecordMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number {
  const winRate = (record: FightRecord[]) => {
    if (record.length === 0) return 0.5;
    const wins = record.filter(r => r.result === 'win').length;
    // Draws count against the denominator but not toward wins (intentional—draws don't prove dominance)
    return wins / record.length;
  };
  const geoMean = Math.sqrt(winRate(recordA) * winRate(recordB));
  return 1.0 + Math.min(RECORD_MAX_BONUS, Math.max(0, geoMean - WIN_RATE_NEUTRAL) * RECORD_SLOPE);
}

export function calcStreakMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number {
  const currentStreak = (record: FightRecord[]) => {
    let streak = 0;
    for (let i = record.length - 1; i >= 0; i--) {
      if (record[i].result !== 'win') break;
      streak++;
    }
    return Math.min(streak, STREAK_MAX_LENGTH);
  };
  const geoMean = Math.sqrt(
    (currentStreak(recordA) / STREAK_MAX_LENGTH) * (currentStreak(recordB) / STREAK_MAX_LENGTH)
  );
  return 1.0 + geoMean * STREAK_MAX_BONUS;
}

interface ViewerParams {
  network: {
    baseViewership: number;
    titleFightMultiplier: number;
    minBoxerRank: number;
    federationId: number;
  };
  gymBoxerRank: number;   // 0–9 reputation index
  opponentRank: number;   // 0–9 reputation index
  isTitleFight: boolean;
  isSameFederation: boolean;
}

export function calcViewers(params: ViewerParams): number {
  const { network, gymBoxerRank, opponentRank, isTitleFight, isSameFederation } = params;

  const base = network.baseViewership * 0.6;
  const homeFederationBonus = isSameFederation ? 1.2 : 1.0;

  const excessA = Math.max(0, gymBoxerRank - network.minBoxerRank);
  const excessB = Math.max(0, opponentRank - network.minBoxerRank);
  const rankBonus = Math.min(1.5, 1 + (excessA + excessB) * 0.05);

  const titleBonus = isTitleFight ? network.titleFightMultiplier : 1.0;

  return Math.round(base * homeFederationBonus * rankBonus * titleBonus);
}

export function calcPpvPayout(viewers: number, ppvSplitPercentage: number): number {
  return Math.round(viewers * (ppvSplitPercentage / 100) * PPV_REVENUE_PER_VIEWER);
}
