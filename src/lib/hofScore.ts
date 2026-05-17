import type { Boxer, Title } from '../db/db';
import { REPUTATION_INDEX } from './reputationIndex';

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function calcHofScore(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): number {
  if (boxer.record.length === 0) return 0;

  const sortedDates = [...boxer.record.map(r => r.date)].sort();
  const firstFightDate = sortedDates[0];

  // Component 1: career length (max 25)
  const careerYears = daysBetween(firstFightDate, currentDate) / 365.25;
  const careerScore = Math.min(25, Math.floor(careerYears));

  // Component 2: peak reputation (max 25)
  const repIndex = REPUTATION_INDEX[boxer.reputation] ?? 0;
  const peakRankScore = (repIndex / 9) * 25;

  // Component 3: title reigns (max 25)
  let reignTotal = 0;
  for (const title of allTitles) {
    for (const reign of title.reigns) {
      if (reign.boxerId !== boxer.id) continue;
      const endDate = reign.dateLost ?? currentDate;
      const reignYears = daysBetween(reign.dateWon, endDate) / 365.25;
      reignTotal += 5 + 2 * reign.defenseCount + 3 * Math.floor(reignYears);
    }
  }
  const titleScore = Math.min(25, reignTotal);

  // Component 4: record quality (max 25)
  const wins = boxer.record.filter(r => r.result === 'win').length;
  const losses = boxer.record.filter(r => r.result === 'loss').length;
  const draws = boxer.record.filter(r => r.result === 'draw').length;
  const totalFights = wins + losses + draws;
  const winRate = totalFights > 0 ? wins / totalFights : 0;
  const recordScore = winRate * 15 + Math.min(10, Math.floor(totalFights / 10));

  return careerScore + peakRankScore + titleScore + recordScore;
}
