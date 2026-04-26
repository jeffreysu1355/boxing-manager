import type { Boxer, BoxerStats, Coach, CoachSkillLevel, FightingStyle } from '../db/db';

export const STYLE_STATS: Record<FightingStyle, (keyof BoxerStats)[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

export const EXP_PER_DAY: Record<CoachSkillLevel, number> = {
  'local': 1,
  'contender': 2,
  'championship-caliber': 4,
  'all-time-great': 8,
};

export function applyTraining(boxer: Boxer, coach: Coach, days: number): Boxer {
  const stats = { ...boxer.stats };
  const exp: Partial<Record<keyof BoxerStats, number>> = { ...(boxer.trainingExp ?? {}) };
  const rate = EXP_PER_DAY[coach.skillLevel];
  const trainedStats = STYLE_STATS[coach.style];
  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));

  for (const stat of trainedStats) {
    const cap = talentSet.has(stat) ? 25 : 20;

    exp[stat] = (exp[stat] ?? 0) + days * rate;

    if (stats[stat] >= cap) continue;

    // Threshold per level-up is fixed at the stat value when training begins
    const threshold = stats[stat] * 10;

    if (stats[stat] === 0) continue; // stats are on 1-20 scale; 0 is invalid

    while (stats[stat] < cap) {
      if ((exp[stat] ?? 0) < threshold) break;
      exp[stat] = (exp[stat] ?? 0) - threshold;
      stats[stat] += 1;
    }
  }

  return { ...boxer, stats, trainingExp: exp };
}
