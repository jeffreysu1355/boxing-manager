import type { Boxer, BoxerStats, Coach, CoachSkillLevel, FightingStyle, NaturalTalent, ReputationLevel } from '../db/db';

const ALL_STATS: (keyof BoxerStats)[] = [
  'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
  'headMovement', 'bodyMovement', 'guard', 'positioning',
  'timing', 'adaptability', 'discipline',
  'speed', 'power', 'endurance', 'recovery', 'toughness',
];

export const STYLE_STATS: Record<FightingStyle, (keyof BoxerStats)[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

export const EXP_PER_DAY: Record<CoachSkillLevel, number> = {
  'local': 0.25,
  'contender': 0.5,
  'championship-caliber': 0.75,
  'all-time-great': 1.0,
};

export function ageTrainingMultiplier(age: number): number {
  if (age <= 35) return 1.0;
  return Math.max(0.1, 1.0 - (age - 35) * 0.05);
}

// Linear decay from 0.0013 at age 18 to a floor of 0.00005 at age 35+.
// Slope = (0.0013 - 0.00005) / 17 ≈ 0.0000735 per year.
// Tuned so a career from 18–40 yields ~4–5 talent gains, concentrated in early years.
export function talentGainProbability(age: number): number {
  return Math.max(0.00005, 0.0013 - (age - 18) * 0.0000735);
}

export function rollTalentGain(
  boxer: Boxer,
  coach: Coach,
  rng: () => number = Math.random,
): NaturalTalent | null {
  if (rng() >= talentGainProbability(boxer.age)) return null;

  const heldStats = new Set(boxer.naturalTalents.map(t => t.stat));
  const coachPool = STYLE_STATS[coach.style].filter(s => !heldStats.has(s));
  const boxerPool = STYLE_STATS[boxer.style].filter(s => !heldStats.has(s) && !coachPool.includes(s));

  // 70% weight to coach stats, 30% to boxer-unique stats
  const weightedPool: (keyof BoxerStats)[] = [
    ...coachPool.flatMap(s => [s, s, s, s, s, s, s]),   // 7 entries each → ~70%
    ...boxerPool.flatMap(s => [s, s, s]),                 // 3 entries each → ~30%
  ];

  if (weightedPool.length === 0) return null;

  const picked = weightedPool[Math.floor(rng() * weightedPool.length)];
  return { stat: picked };
}

export function applyTraining(boxer: Boxer, coach: Coach, days: number, gymLevel: number = 1, rng: () => number = Math.random): Boxer {
  const stats = { ...boxer.stats };
  const exp: Partial<Record<keyof BoxerStats, number>> = { ...(boxer.trainingExp ?? {}) };
  const gymMultiplier = 1 + (gymLevel - 1) * 0.01;
  const rate = EXP_PER_DAY[coach.skillLevel] * gymMultiplier * ageTrainingMultiplier(boxer.age);
  const focusSet = new Set(STYLE_STATS[coach.style]);

  // Roll for talent gain once per simulated day, updating naturalTalents as we go
  // so each day's roll reflects any talents just gained (no duplicate picks).
  let naturalTalents = [...boxer.naturalTalents];
  for (let d = 0; d < days; d++) {
    const gained = rollTalentGain({ ...boxer, naturalTalents }, coach, rng);
    if (gained) naturalTalents = [...naturalTalents, gained];
  }

  const talentSet = new Set(naturalTalents.map(t => t.stat));

  for (const stat of ALL_STATS) {
    const statRate = focusSet.has(stat) ? rate : rate * 0.5;
    const cap = talentSet.has(stat) ? 25 : 20;

    exp[stat] = (exp[stat] ?? 0) + days * statRate;

    if (stats[stat] >= cap) continue;
    if (stats[stat] === 0) continue;

    while (stats[stat] < cap) {
      const threshold = stats[stat] * 7.5;
      if ((exp[stat] ?? 0) < threshold) break;
      exp[stat] = (exp[stat] ?? 0) - threshold;
      stats[stat] += 1;
    }
  }

  return { ...boxer, stats, trainingExp: exp, naturalTalents };
}

export function dateDiffDaysTraining(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function computeTrainingCampBoost(
  boxer: Boxer,
  coach: Coach,
  campStartDate: string,
  fightDate: string,
  currentDate: string,
): Partial<Record<keyof BoxerStats, number>> {
  const totalDays = Math.min(60, Math.max(0, dateDiffDaysTraining(campStartDate, fightDate)));
  const trainedDays = Math.min(totalDays, Math.max(0, dateDiffDaysTraining(campStartDate, currentDate)));

  if (totalDays === 0 || trainedDays === 0) return {};

  const earlySegment = Math.max(0, totalDays - 14);
  const earlyDays = Math.min(trainedDays, earlySegment);
  const lateDays = Math.max(0, trainedDays - earlySegment);

  const earlyFraction = earlySegment > 0 ? (earlyDays / earlySegment) * 0.80 : 0;
  const lateFraction = lateDays > 0 ? (lateDays / 14) * 0.20 : 0;
  const boostFraction = earlyFraction + lateFraction;

  const focusSet = new Set(STYLE_STATS[coach.style]);
  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of ALL_STATS) {
    const boostMultiplier = focusSet.has(stat) ? 0.50 : 0.25;
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * boostMultiplier * boostFraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}

// Exp gained per stat from a single fight, equivalent to 60 days of training
// at a rate scaled by reputation (higher rank = tougher competition = more exp).
export const FIGHT_EXP_BY_REPUTATION: Record<ReputationLevel, number> = {
  'Unknown':               0.25 * 60,  // 15
  'Local Star':            0.30 * 60,  // 18
  'Rising Star':           0.35 * 60,  // 21
  'Respectable Opponent':  0.40 * 60,  // 24
  'Contender':             0.50 * 60,  // 30
  'Championship Caliber':  0.60 * 60,  // 36
  'Nationally Ranked':     0.70 * 60,  // 42
  'World Class Fighter':   0.80 * 60,  // 48
  'International Superstar': 0.90 * 60, // 54
  'All-Time Great':        1.00 * 60,  // 60
};

export function applyFightExp(boxer: Boxer): Boxer {
  const exp: Partial<Record<keyof BoxerStats, number>> = { ...(boxer.trainingExp ?? {}) };
  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const gainPerStat = FIGHT_EXP_BY_REPUTATION[boxer.reputation];
  const stats = { ...boxer.stats };

  for (const stat of ALL_STATS) {
    const cap = talentSet.has(stat) ? 25 : 20;
    exp[stat] = (exp[stat] ?? 0) + gainPerStat;

    if (stats[stat] >= cap) continue;
    if (stats[stat] === 0) continue;

    while (stats[stat] < cap) {
      const threshold = stats[stat] * 7.5;
      if ((exp[stat] ?? 0) < threshold) break;
      exp[stat] = (exp[stat] ?? 0) - threshold;
      stats[stat] += 1;
    }
  }

  return { ...boxer, stats, trainingExp: exp };
}

export const NPC_BOOST_BY_REPUTATION: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 0.05,
  'Rising Star': 0.10,
  'Respectable Opponent': 0.15,
  'Contender': 0.20,
  'Championship Caliber': 0.25,
  'Nationally Ranked': 0.30,
  'World Class Fighter': 0.35,
  'International Superstar': 0.40,
  'All-Time Great': 0.45,
};

export function computeNpcBoost(boxer: Boxer): Partial<Record<keyof BoxerStats, number>> {
  const fraction = NPC_BOOST_BY_REPUTATION[boxer.reputation] ?? 0;
  if (fraction === 0) return {};

  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of STYLE_STATS[boxer.style]) {
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * fraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}
