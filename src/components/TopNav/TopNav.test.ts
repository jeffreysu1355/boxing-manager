import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB } from '../../db/db';
import { putBoxer } from '../../db/boxerStore';
import { putFight } from '../../db/fightStore';
import { putTitle, getAllTitles } from '../../db/titleStore';
import { putFederation } from '../../db/federationStore';
import { putFightContract } from '../../db/fightContractStore';
import { applyFightResult } from './fightResultApplier';
import type { BoxerStats } from '../../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

beforeEach(async () => {
  // @ts-expect-error fake-indexeddb
  global.indexedDB = new IDBFactory();
  await closeAndResetDB();
});

afterEach(async () => {
  await closeAndResetDB();
});

describe('applyFightResult', () => {
  it('adds winnerRecord and loserRecord to boxer fight histories', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const winnerId = await putBoxer({
      name: 'Winner', age: 25, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Unknown', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const loserId = await putBoxer({
      name: 'Loser', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const contractId = await putFightContract({
      boxerId: winnerId, opponentId: loserId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 1000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: false, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [winnerId, loserId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: false, contractId,
    });

    await applyFightResult({
      fightId,
      winnerId,
      loserId,
      method: 'KO',
      finishingMove: 'Rear Hook',
      round: 3,
      time: '1:45',
      winnerRecord: {
        result: 'win', opponentName: 'Loser', opponentId: loserId,
        method: 'KO', finishingMove: 'Rear Hook', round: 3, time: '1:45',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'Winner', opponentId: winnerId,
        method: 'KO', finishingMove: 'Rear Hook', round: 3, time: '1:45',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: false,
      federationId: fedId,
      weightClass: 'welterweight',
      fightDate: '2026-03-14',
      contractId,
    });

    const { getBoxer } = await import('../../db/boxerStore');
    const winner = await getBoxer(winnerId);
    const loser = await getBoxer(loserId);
    expect(winner!.record).toHaveLength(1);
    expect(winner!.record[0].result).toBe('win');
    expect(loser!.record).toHaveLength(1);
    expect(loser!.record[0].result).toBe('loss');
  });

  it('updates title on a title fight win', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const oldChampId = await putBoxer({
      name: 'Old Champ', age: 30, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Championship Caliber', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const challengerId = await putBoxer({
      name: 'Challenger', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Contender', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const titleId = await putTitle({
      federationId: fedId, weightClass: 'welterweight',
      currentChampionId: oldChampId,
      reigns: [{ boxerId: oldChampId, dateWon: '2025-01-01', dateLost: null, defenseCount: 2 }],
    });
    const contractId = await putFightContract({
      boxerId: challengerId, opponentId: oldChampId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 10000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: true, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [challengerId, oldChampId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: true, contractId,
    });

    await applyFightResult({
      fightId,
      winnerId: challengerId,
      loserId: oldChampId,
      method: 'Decision',
      finishingMove: null,
      round: 12,
      time: '3:00',
      winnerRecord: {
        result: 'win', opponentName: 'Old Champ', opponentId: oldChampId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'Challenger', opponentId: challengerId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: true,
      federationId: fedId,
      weightClass: 'welterweight',
      fightDate: '2026-03-14',
      contractId,
    });

    const { getTitle } = await import('../../db/titleStore');
    const title = await getTitle(titleId);
    expect(title!.currentChampionId).toBe(challengerId);
    expect(title!.reigns).toHaveLength(2);
    expect(title!.reigns[0].dateLost).toBe('2026-03-14');
    expect(title!.reigns[1].boxerId).toBe(challengerId);
    expect(title!.reigns[1].dateLost).toBeNull();
  });

  it('increases winner rankPoints and sets lastRankDelta after applyFightResult', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const winnerId = await putBoxer({
      name: 'RankWinner', age: 25, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Unknown', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
      rankPoints: 0, demotionBuffer: 10,
    });
    const loserId = await putBoxer({
      name: 'RankLoser', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
      rankPoints: 0, demotionBuffer: 10,
    });
    const contractId = await putFightContract({
      boxerId: winnerId, opponentId: loserId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 1000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: false, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [winnerId, loserId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: false, contractId,
    });

    await applyFightResult({
      fightId, winnerId, loserId, method: 'KO', finishingMove: 'Cross',
      round: 5, time: '2:10',
      winnerRecord: {
        result: 'win', opponentName: 'RankLoser', opponentId: loserId,
        method: 'KO', finishingMove: 'Cross', round: 5, time: '2:10',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'RankWinner', opponentId: winnerId,
        method: 'KO', finishingMove: 'Cross', round: 5, time: '2:10',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: false, federationId: fedId, weightClass: 'welterweight',
      fightDate: '2026-03-14', contractId,
    });

    const { getBoxer } = await import('../../db/boxerStore');
    const winner = await getBoxer(winnerId);
    expect(winner!.rankPoints).toBeGreaterThan(0);
    expect(winner!.lastRankDelta).toBeDefined();
  });

  it('marks the fight contract as completed', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const winnerId = await putBoxer({
      name: 'W', age: 25, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Unknown', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const loserId = await putBoxer({
      name: 'L', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const contractId = await putFightContract({
      boxerId: winnerId, opponentId: loserId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 1000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: false, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [winnerId, loserId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: false, contractId,
    });

    await applyFightResult({
      fightId, winnerId, loserId, method: 'Decision', finishingMove: null,
      round: 12, time: '3:00',
      winnerRecord: {
        result: 'win', opponentName: 'L', opponentId: loserId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'W', opponentId: winnerId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: false, federationId: fedId, weightClass: 'welterweight',
      fightDate: '2026-03-14', contractId,
    });

    const { getFightContract } = await import('../../db/fightContractStore');
    const contract = await getFightContract(contractId);
    expect(contract!.status).toBe('completed');
  });
});
