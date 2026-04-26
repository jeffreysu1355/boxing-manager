export const PPV_REVENUE_PER_VIEWER = 0.50;

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
