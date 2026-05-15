import { getFight, putFight } from '../../db/fightStore';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getTitlesByFederation, putTitle } from '../../db/titleStore';
import { getFightContract, putFightContract } from '../../db/fightContractStore';
import { applyRankChange } from '../../lib/rankSystem';
import { applyFightExp } from '../../lib/training';
import { getPpvNetwork } from '../../db/ppvNetworkStore';
import { calcViewers, calcPpvPayout } from '../../lib/ppvCalc';
import { REPUTATION_INDEX } from '../../lib/reputationIndex';
import { logTransaction } from '../../db/transactionStore';
import type { FightMethod, FightRecord, WeightClass, RoundLogEntry } from '../../db/db';

export interface ApplyFightResultParams {
  fightId: number;
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
  isTitleFight: boolean;
  federationId: number;
  weightClass: WeightClass;
  fightDate: string;
  contractId: number | null;
  gymBoxerFirstId: number;
  roundLog?: RoundLogEntry[];
}

export async function applyFightResult(params: ApplyFightResultParams): Promise<void> {
  const {
    fightId, winnerId, loserId, method, finishingMove, round, time,
    winnerRecord, loserRecord, isTitleFight, federationId, weightClass,
    fightDate, contractId, gymBoxerFirstId, roundLog,
  } = params;

  // 1. Update Fight record
  const fight = await getFight(fightId);
  if (fight) {
    await putFight({ ...fight, winnerId, method, finishingMove, round, time, ...(roundLog ? { roundLog } : {}) });
  }

  // 2. Push records onto both boxers and apply rank changes
  const [winner, loser] = await Promise.all([getBoxer(winnerId), getBoxer(loserId)]);
  if (winner && loser) {
    const updatedWinner = applyRankChange(
      { ...winner, record: [...winner.record, winnerRecord] },
      loser,
      'win',
      isTitleFight,
    );
    const updatedLoser = applyRankChange(
      { ...loser, record: [...loser.record, loserRecord] },
      winner,
      'loss',
      isTitleFight,
    );
    const clearBoostWinner = updatedWinner.tempStatBoost?.expiresOnFightId === fightId
      ? { ...updatedWinner, tempStatBoost: undefined }
      : updatedWinner;
    const clearBoostLoser = updatedLoser.tempStatBoost?.expiresOnFightId === fightId
      ? { ...updatedLoser, tempStatBoost: undefined }
      : updatedLoser;
    await Promise.all([
      putBoxer(applyFightExp(clearBoostWinner)),
      putBoxer(applyFightExp(clearBoostLoser)),
    ]);
  } else {
    if (winner) {
      const withRecord = { ...winner, record: [...winner.record, winnerRecord] };
      const cleared = withRecord.tempStatBoost?.expiresOnFightId === fightId
        ? { ...withRecord, tempStatBoost: undefined }
        : withRecord;
      await putBoxer(applyFightExp(cleared));
    }
    if (loser) {
      const withRecord = { ...loser, record: [...loser.record, loserRecord] };
      const cleared = withRecord.tempStatBoost?.expiresOnFightId === fightId
        ? { ...withRecord, tempStatBoost: undefined }
        : withRecord;
      await putBoxer(applyFightExp(cleared));
    }
  }

  // 3. Title transfer
  if (isTitleFight) {
    const titles = await getTitlesByFederation(federationId);
    const title = titles.find(t => t.weightClass === weightClass);
    if (title && title.id !== undefined) {
      const updatedReigns = title.reigns.map(r =>
        r.dateLost === null ? { ...r, dateLost: fightDate } : r
      );
      updatedReigns.push({ boxerId: winnerId, dateWon: fightDate, dateLost: null, defenseCount: 0 });
      await putTitle({ ...title, currentChampionId: winnerId, reigns: updatedReigns });
    }
  }

  // 4. Mark contract completed and apply payouts
  if (contractId !== null) {
    const contract = await getFightContract(contractId);
    if (contract) {
      await putFightContract({ ...contract, status: 'completed' });

      // Identify gym boxer and opponent for descriptions
      const gymBoxer = winner?.id === gymBoxerFirstId ? winner : loser;
      const opponent = winner?.id === gymBoxerFirstId ? loser : winner;
      const gymBoxerName = gymBoxer?.name ?? 'Gym Boxer';
      const opponentName = opponent?.name ?? 'Opponent';

      // Guaranteed payout
      if (contract.guaranteedPayout > 0) {
        await logTransaction({
          date: fightDate,
          description: `Fight payout: ${gymBoxerName} vs ${opponentName}`,
          amount: contract.guaranteedPayout,
          category: 'fight_payout',
        });
      }

      // PPV payout with ±20% variance
      if (contract.ppvNetworkId !== null) {
        const network = await getPpvNetwork(contract.ppvNetworkId);
        if (network) {
          const gymBoxerRank = REPUTATION_INDEX[gymBoxer?.reputation ?? 'Unknown'] ?? 0;
          const opponentRank = REPUTATION_INDEX[opponent?.reputation ?? 'Unknown'] ?? 0;
          const baseViewers = calcViewers({
            network,
            gymBoxerRank,
            opponentRank,
            isTitleFight,
            isSameFederation: network.federationId === federationId,
          });
          const actualViewers = Math.round(baseViewers * (0.8 + Math.random() * 0.4));
          const ppvPayout = calcPpvPayout(actualViewers, contract.ppvSplitPercentage);
          if (ppvPayout > 0) {
            await logTransaction({
              date: fightDate,
              description: `PPV payout: ${gymBoxerName} vs ${opponentName} (${network.name})`,
              amount: ppvPayout,
              category: 'ppv_payout',
            });
          }
        }
      }
    }
  }
}
