import { getAllBoxers, putBoxer } from '../db/boxerStore';
import { getAllFights, putFight, deleteFight } from '../db/fightStore';
import { getAllTitles, putTitle } from '../db/titleStore';
import { getFederation } from '../db/federationStore';
import { simulateFight } from './fightSim';
import { applyRankChange, REPUTATION_ORDER } from './rankSystem';
import { addDays } from './simTime';
import { retireBoxer, type RetireResult } from './retireBoxer';
import { REPUTATION_INDEX } from './reputationIndex';
import type { Boxer, Fight, Title, WeightClass } from '../db/db';

export function rollNextFightDate(fromDate: string): string {
  const days = Math.floor(Math.random() * 91) + 90; // 90–180
  return addDays(fromDate, days);
}

function winRate(boxer: Boxer): number {
  const proFights = boxer.record.filter(r => r.result === 'win' || r.result === 'loss');
  if (proFights.length === 0) return 0.5;
  return proFights.filter(r => r.result === 'win').length / proFights.length;
}

function repIndex(boxer: Boxer): number {
  return REPUTATION_ORDER.indexOf(boxer.reputation);
}

function scoreCandidate(boxer: Boxer, candidate: Boxer): number {
  const gap = repIndex(candidate) - repIndex(boxer);
  if (Math.abs(gap) > 1) return 0;

  const rate = winRate(boxer);

  if (rate < 0.40) {
    if (gap === 1) return 3;
    if (gap === 0) return 1;
    return 0;
  }

  if (rate >= 0.60) {
    if (gap === 0)  return 2;
    if (gap === -1) return 1;
    return 0;
  }

  if (gap === 0)              return 3;
  if (gap === 1 || gap === -1) return 1;
  return 0;
}

export function pickOpponent(
  boxer: Boxer,
  candidates: Boxer[],
  matchedIds: Set<number>,
): Boxer | null {
  const scored = candidates
    .filter(c =>
      c.id !== boxer.id &&
      c.id !== undefined &&
      !matchedIds.has(c.id!) &&
      c.weightClass === boxer.weightClass
    )
    .map(c => ({ boxer: c, score: scoreCandidate(boxer, c) }))
    .filter(({ score }) => score > 0);

  if (scored.length === 0) return null;

  const total = scored.reduce((s, { score }) => s + score, 0);
  let r = Math.random() * total;
  for (const { boxer: c, score } of scored) {
    r -= score;
    if (r <= 0) return c;
  }
  return scored[scored.length - 1].boxer;
}

export function shouldBeTitleFight(
  a: Boxer,
  b: Boxer,
  titles: Title[],
): boolean {
  if (a.federationId === null || b.federationId === null) return false;
  if (a.federationId !== b.federationId) return false;

  const relevantTitles = titles.filter(
    t => t.federationId === a.federationId && t.weightClass === a.weightClass
  );

  let aIsChamp = false;
  let bIsChamp = false;
  for (const title of relevantTitles) {
    if (title.currentChampionId === a.id) aIsChamp = true;
    if (title.currentChampionId === b.id) bIsChamp = true;
  }

  return aIsChamp !== bIsChamp;
}

function transferTitle(
  winnerId: number,
  loserId: number,
  federationId: number,
  weightClass: WeightClass,
  fightDate: string,
  titles: Title[],
): Title | null {
  const title = titles.find(
    t => t.federationId === federationId && t.weightClass === weightClass && t.currentChampionId === loserId
  );
  if (!title) return null;

  const updatedReigns = title.reigns.map(r =>
    r.dateLost === null ? { ...r, dateLost: fightDate } : r
  );
  updatedReigns.push({ boxerId: winnerId, dateWon: fightDate, dateLost: null, defenseCount: 0 });
  return { ...title, currentChampionId: winnerId, reigns: updatedReigns };
}

export function shouldNpcRetire(
  age: number,
  reputation: import('../db/db').ReputationLevel,
  roll: number = Math.random(),
): boolean {
  if (age < 35) return false;
  if (age >= 45) return true;
  const dailyChance = Math.max(0, (age - 34) * 0.002 - (REPUTATION_INDEX[reputation] ?? 0) * 0.0002);
  return roll < dailyChance;
}

export async function simulateNpcFights(fromDate: string, toDate: string): Promise<RetireResult[]> {
  const [allBoxers, allTitles] = await Promise.all([getAllBoxers(), getAllTitles()]);

  // Only federation-affiliated boxers — free agents/prospects are regenerated monthly and their IDs become stale
  const pool = allBoxers.filter(b => b.gymId === null && b.federationId !== null && b.id !== undefined);

  const eligible = pool.filter(b =>
    b.nextFightDate !== undefined &&
    b.nextFightDate > fromDate &&
    b.nextFightDate <= toDate
  );

  const matchedIds = new Set<number>();
  const titlesMap = new Map<number, Title>(allTitles.map(t => [t.id!, t]));

  for (const boxer of eligible) {
    if (matchedIds.has(boxer.id!)) continue;

    const opponent = pickOpponent(boxer, pool, matchedIds);
    if (!opponent) {
      await putBoxer({ ...boxer, nextFightDate: addDays(boxer.nextFightDate!, 30) });
      continue;
    }

    matchedIds.add(boxer.id!);
    matchedIds.add(opponent.id!);

    const currentTitles = Array.from(titlesMap.values());
    const isTitleFight = shouldBeTitleFight(boxer, opponent, currentTitles);

    const fightFederationId =
      boxer.federationId !== null && boxer.federationId === opponent.federationId
        ? boxer.federationId
        : null;

    let federationName = 'Independent';
    if (fightFederationId !== null) {
      const fed = await getFederation(fightFederationId);
      if (fed) federationName = fed.name;
    }

    const fightDate = boxer.nextFightDate!;

    const fightShell: Omit<Fight, 'id'> = {
      date: fightDate,
      federationId: fightFederationId ?? -1,
      weightClass: boxer.weightClass,
      boxerIds: [boxer.id!, opponent.id!],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight,
      contractId: null,
    };

    const fightId = await putFight(fightShell);
    const fight: Fight = { ...fightShell, id: fightId };

    const simResult = simulateFight(boxer, opponent, fight, federationName);

    await putFight({
      ...fight,
      winnerId: simResult.winnerId,
      method: simResult.method,
      finishingMove: simResult.finishingMove,
      round: simResult.round,
      time: simResult.time,
    });

    const winnerBoxer = simResult.winnerId === boxer.id ? boxer : opponent;
    const loserBoxer = simResult.loserId === boxer.id ? boxer : opponent;

    const updatedWinner = applyRankChange(
      { ...winnerBoxer, record: [...winnerBoxer.record, simResult.winnerRecord] },
      loserBoxer,
      'win',
      isTitleFight,
    );
    const updatedLoser = applyRankChange(
      { ...loserBoxer, record: [...loserBoxer.record, simResult.loserRecord] },
      winnerBoxer,
      'loss',
      isTitleFight,
    );

    await Promise.all([
      putBoxer({ ...updatedWinner, nextFightDate: rollNextFightDate(fightDate) }),
      putBoxer({ ...updatedLoser, nextFightDate: rollNextFightDate(fightDate) }),
    ]);

    if (isTitleFight && fightFederationId !== null) {
      const updated = transferTitle(
        simResult.winnerId,
        simResult.loserId,
        fightFederationId,
        boxer.weightClass,
        fightDate,
        currentTitles,
      );
      if (updated && updated.id !== undefined) {
        await putTitle(updated);
        titlesMap.set(updated.id, updated);
      }
    }
  }

  // NPC retirement pass
  const retireResults: RetireResult[] = [];
  const retirableTitles = Array.from(titlesMap.values());
  const allBoxersForRetire = await getAllBoxers();
  const npcEligible = allBoxersForRetire.filter(
    b => b.gymId === null && b.federationId !== null && !b.retired && b.id !== undefined && (b.age ?? 0) >= 35
  );
  for (const boxer of npcEligible) {
    if (shouldNpcRetire(boxer.age, boxer.reputation)) {
      const result = await retireBoxer(boxer, retirableTitles, toDate);
      retireResults.push(result);
    }
  }

  const cutoff = addDays(toDate, -365);
  const allFights = await getAllFights();
  const stale = allFights.filter(f => f.contractId === null && f.date < cutoff);
  await Promise.all(stale.map(f => deleteFight(f.id!)));

  return retireResults;
}
