import type { Boxer, BoxerStats } from '../db/db';
import { STYLE_STATS } from './training';

export function shouldAgeBoxer(
  birthDate: string,
  lastAgedYear: number,
  newYear: number,
  newMonth: number,
): boolean {
  if (newYear <= lastAgedYear) return false;
  const birthMonth = Number(birthDate.split('-')[1]);
  return newMonth >= birthMonth;
}

export function regressionPointsPerMonth(age: number): number {
  if (age <= 35) return 0;
  return Math.floor((age - 35) * 0.15);
}

export function applyStatRegression(boxer: Boxer): Boxer {
  const points = regressionPointsPerMonth(boxer.age);
  if (points === 0) return boxer;

  const styleSet = new Set<keyof BoxerStats>(STYLE_STATS[boxer.style]);
  const allStats = Object.keys(boxer.stats) as (keyof BoxerStats)[];

  const nonStyleStats = allStats.filter(s => !styleSet.has(s));
  const styleStats = allStats.filter(s => styleSet.has(s));

  const stats = { ...boxer.stats };
  let remaining = points;

  for (const pool of [nonStyleStats, styleStats]) {
    if (remaining === 0) break;
    const sorted = [...pool].sort((a, b) => stats[a] - stats[b]);
    for (const stat of sorted) {
      if (remaining === 0) break;
      if (stats[stat] <= 1) continue;
      stats[stat] -= 1;
      remaining -= 1;
    }
  }

  return { ...boxer, stats };
}
