import type { Boxer, Title } from '../db/db';
import { putBoxer } from '../db/boxerStore';
import { putHofEntry, getHofEntryByBoxer } from '../db/hallOfFameStore';
import { calcHofScore } from './hofScore';

const HOF_THRESHOLD = 50;

export interface RetireResult {
  inducted: boolean;
  score: number;
  boxerName: string;
}

export async function retireBoxer(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): Promise<RetireResult> {
  const score = calcHofScore(boxer, allTitles, currentDate);
  const inducted = score >= HOF_THRESHOLD;

  const wins = boxer.record.filter(r => r.result === 'win').length;
  const losses = boxer.record.filter(r => r.result === 'loss').length;
  const draws = boxer.record.filter(r => r.result === 'draw').length;

  const sortedDates = [...boxer.record.map(r => r.date)].sort();
  const firstFightDate = sortedDates[0];
  const careerSpan = firstFightDate
    ? (new Date(currentDate).getTime() - new Date(firstFightDate).getTime()) / (365.25 * 86_400_000)
    : 0;

  let titlesWon = 0;
  let totalDefenses = 0;
  for (const title of allTitles) {
    for (const reign of title.reigns) {
      if (reign.boxerId !== boxer.id) continue;
      titlesWon++;
      totalDefenses += reign.defenseCount;
    }
  }

  await putBoxer({ ...boxer, retired: true, hofScore: score });

  if (inducted && boxer.id !== undefined) {
    const existing = await getHofEntryByBoxer(boxer.id);
    if (!existing) await putHofEntry({
      boxerId: boxer.id,
      boxerName: boxer.name,
      weightClass: boxer.weightClass,
      inductedDate: currentDate,
      score,
      peakReputation: boxer.reputation,
      record: { wins, losses, draws },
      totalFights: wins + losses + draws,
      careerSpan,
      titlesWon,
      totalDefenses,
    });
  }

  return { inducted, score, boxerName: boxer.name };
}
