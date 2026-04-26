import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Fight, FightContract, Boxer, Federation, PpvNetwork } from '../../db/db';
import { getFight } from '../../db/fightStore';
import { getAllFightContracts, putFightContract } from '../../db/fightContractStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { getPpvNetworksByFederation } from '../../db/ppvNetworkStore';
import { calcViewers, calcPpvPayout } from '../../lib/ppvCalc';
import styles from './PpvSignup.module.css';

const REPUTATION_INDEX: Record<string, number> = {
  'Unknown': 0, 'Local Star': 1, 'Rising Star': 2, 'Respectable Opponent': 3,
  'Contender': 4, 'Championship Caliber': 5, 'Nationally Ranked': 6,
  'World Class Fighter': 7, 'International Superstar': 8, 'All-Time Great': 9,
};

const RANK_LABELS: Record<number, string> = {
  0: 'Open', 1: 'Local Star+', 2: 'Rising Star+', 3: 'Respectable Opponent+',
  4: 'Contender+', 5: 'Championship Caliber+', 6: 'Nationally Ranked+',
  7: 'World Class Fighter+', 8: 'International Superstar+', 9: 'All-Time Great',
};

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface PageData {
  fight: Fight;
  contract: FightContract;
  gymBoxer: Boxer;
  opponent: Boxer;
  federation: Federation;
  networks: PpvNetwork[];
}

export default function PpvSignup() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNetworkId, setSelectedNetworkId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const id = fightId ? parseInt(fightId, 10) : NaN;
      if (isNaN(id)) { setLoadError('Invalid fight ID.'); return; }

      const fight = await getFight(id);
      if (!fight || !fight.id) { setLoadError('Fight not found.'); return; }

      const [gymBoxer, opponent, federation] = await Promise.all([
        getBoxer(fight.boxerIds[0]),
        getBoxer(fight.boxerIds[1]),
        getFederation(fight.federationId),
      ]);

      if (!gymBoxer || !opponent) { setLoadError('Boxer data not found.'); return; }
      if (!federation) { setLoadError('Federation not found.'); return; }

      const contractList = await getAllFightContracts();
      const contract = contractList.find(c => c.fightId === id);
      if (!contract) { setLoadError('Contract not found.'); return; }

      const networks = await getPpvNetworksByFederation(fight.federationId);
      networks.sort((a, b) => a.minBoxerRank - b.minBoxerRank || a.baseViewership - b.baseViewership);

      if (cancelled) return;
      setData({ fight, contract, gymBoxer, opponent, federation, networks });
      if (contract.ppvNetworkId !== null) {
        setSelectedNetworkId(contract.ppvNetworkId);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fightId]);

  async function handleConfirm() {
    if (!data || saving) return;
    setSaving(true);
    try {
      await putFightContract({ ...data.contract, ppvNetworkId: selectedNetworkId });
      navigate('/league/calendar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (!data || saving) return;
    setSaving(true);
    try {
      await putFightContract({ ...data.contract, ppvNetworkId: null });
      navigate('/league/calendar');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader title="PPV Network" subtitle="" />
        <p className={styles.error}>{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <PageHeader title="PPV Network" subtitle="" />
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  const { fight, contract, gymBoxer, opponent, federation, networks } = data;
  const gymRank = REPUTATION_INDEX[gymBoxer.reputation] ?? 0;
  const oppRank = REPUTATION_INDEX[opponent.reputation] ?? 0;
  const bestRank = Math.max(gymRank, oppRank);
  const bestRankLabel = gymRank >= oppRank ? gymBoxer.reputation : opponent.reputation;

  return (
    <div className={styles.page}>
      <PageHeader title="PPV Network" subtitle="Sign a PPV deal for your upcoming fight" />

      <p className={styles.fightSummary}>
        <strong>{gymBoxer.name}</strong> vs <strong>{opponent.name}</strong>
        {' · '}{federation.name}
        {' · '}{formatDate(fight.date)}
        {fight.isTitleFight && <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>Title Fight</span>}
      </p>

      <div className={styles.networkList}>
        {networks.map(network => {
          if (network.id === undefined) return null;
          const eligible = bestRank >= network.minBoxerRank;
          const isSelected = selectedNetworkId === network.id;
          const isSameFederation = network.federationId === fight.federationId;

          const viewers = calcViewers({
            network,
            gymBoxerRank: gymRank,
            opponentRank: oppRank,
            isTitleFight: fight.isTitleFight,
            isSameFederation,
          });
          const payout = calcPpvPayout(viewers, contract.ppvSplitPercentage);

          const cardClass = [
            styles.networkCard,
            isSelected ? styles.networkCardSelected : '',
            !eligible ? styles.networkCardDisabled : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={network.id}
              className={cardClass}
              onClick={() => { if (eligible) setSelectedNetworkId(isSelected ? null : network.id!); }}
              role={eligible ? 'button' : undefined}
              tabIndex={eligible ? 0 : -1}
              onKeyDown={e => {
                if (eligible && (e.key === 'Enter' || e.key === ' ')) {
                  setSelectedNetworkId(isSelected ? null : network.id!);
                }
              }}
            >
              <div className={styles.networkName}>{network.name}</div>
              <div className={styles.networkMeta}>
                <span>Req: {RANK_LABELS[network.minBoxerRank] ?? 'Open'}</span>
                <span>Est. viewers: {formatViewers(viewers)}</span>
                {fight.isTitleFight && (
                  <span>Title bonus: ×{network.titleFightMultiplier.toFixed(1)}</span>
                )}
              </div>
              {eligible ? (
                <div className={styles.networkPayout}>
                  Est. PPV payout: ${payout.toLocaleString()} ({contract.ppvSplitPercentage}% split)
                </div>
              ) : (
                <div className={styles.networkIneligible}>
                  Requires {RANK_LABELS[network.minBoxerRank]} — best boxer is {bestRankLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={handleConfirm}
          disabled={saving || selectedNetworkId === null}
        >
          {saving ? 'Saving...' : 'Confirm'}
        </button>
        <button
          className={styles.skipBtn}
          onClick={handleSkip}
          disabled={saving}
        >
          Skip PPV
        </button>
      </div>
    </div>
  );
}
