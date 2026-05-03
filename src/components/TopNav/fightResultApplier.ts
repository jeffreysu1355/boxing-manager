import { getFight, putFight } from '../../db/fightStore';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getTitlesByFederation, putTitle } from '../../db/titleStore';
import { getFightContract, putFightContract } from '../../db/fightContractStore';
import { applyRankChange } from '../../lib/rankSystem';
import type { FightMethod, FightRecord, WeightClass } from '../../db/db';

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
}

export async function applyFightResult(params: ApplyFightResultParams): Promise<void> {
  const {
    fightId, winnerId, loserId, method, finishingMove, round, time,
    winnerRecord, loserRecord, isTitleFight, federationId, weightClass,
    fightDate, contractId,
  } = params;

  // 1. Update Fight record
  const fight = await getFight(fightId);
  if (fight) {
    await putFight({ ...fight, winnerId, method, finishingMove, round, time });
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
    await Promise.all([putBoxer(updatedWinner), putBoxer(updatedLoser)]);
  } else {
    // Rank changes require both boxers present; save records only if one is missing
    if (winner) await putBoxer({ ...winner, record: [...winner.record, winnerRecord] });
    if (loser)  await putBoxer({ ...loser,  record: [...loser.record,  loserRecord]  });
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

  // 4. Mark contract completed (skip for NPC fights which have no contract)
  if (contractId !== null) {
    const contract = await getFightContract(contractId);
    if (contract) {
      await putFightContract({ ...contract, status: 'completed' });
    }
  }
}
