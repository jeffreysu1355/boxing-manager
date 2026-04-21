import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { FightContract, Boxer, Federation } from '../../db/db';
import type { ReputationLevel } from '../../db/db';
import { getFightContract, putFightContract, deleteFightContract } from '../../db/fightContractStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { putFight } from '../../db/fightStore';
import { putCalendarEvent } from '../../db/calendarEventStore';
import { updateFederationEventFights, getFederationEventsByFederation } from '../../db/federationEventStore';
import styles from './ContractNegotiation.module.css';

// --- Types ---

export type AiDecision =
  | { outcome: 'accept' }
  | { outcome: 'counter'; payout: number | null; ppvSplit: number | null }
  | { outcome: 'reject' };

// --- Pure helpers ---

/**
 * Snaps n up to the nearest valid payout increment.
 * Valid increments: $1k–$10k by $1k, $10k–$100k by $10k, $100k–$1M by $100k.
 * Caps at $1,000,000.
 */
export function snapToIncrement(n: number): number {
  if (n <= 0) return 1000;
  if (n > 1_000_000) return 1_000_000;
  if (n <= 10_000) return Math.ceil(n / 1_000) * 1_000;
  if (n <= 100_000) return Math.ceil(n / 10_000) * 10_000;
  return Math.ceil(n / 100_000) * 100_000;
}

/**
 * Snaps n DOWN to the nearest valid payout increment.
 * Used when the AI counter-offers a lower value.
 */
export function snapToIncrementDown(n: number): number {
  if (n <= 0) return 1000;
  if (n > 1_000_000) return 1_000_000;
  if (n <= 10_000) return Math.max(1_000, Math.floor(n / 1_000) * 1_000);
  if (n <= 100_000) return Math.max(10_000, Math.floor(n / 10_000) * 10_000);
  return Math.max(100_000, Math.floor(n / 100_000) * 100_000);
}

/**
 * Snaps n DOWN to the nearest multiple of 5, clamped 0–100.
 * Used when the AI counter-offers a lower PPV split.
 */
export function snapTo5Down(n: number): number {
  const snapped = Math.floor(n / 5) * 5;
  return Math.min(100, Math.max(0, snapped));
}

/**
 * Snaps n up to the nearest multiple of 5, clamped 0–100.
 */
export function snapTo5(n: number): number {
  const snapped = Math.ceil(n / 5) * 5;
  return Math.min(100, Math.max(0, snapped));
}

/**
 * Evaluates a player's contract offer and returns the AI's decision.
 *
 * The opponent is selfish: they accept when the player asks for little,
 * and reject/counter when the player demands too much.
 *
 * fairPayout and fairPpvSplit represent what the player would receive in a
 * "balanced" deal given the reputation gap:
 *   - Bigger name opponent (positive repGap) → lower fair values (you need them more)
 *   - Lesser opponent (negative repGap) → higher fair values (they need you more)
 *
 * offerScore = (playerPayout / fairPayout) + (playerPpvSplit / fairPpvSplit)
 *   Low score (< 0.8)  → opponent happy, accepts
 *   High score (> 1.8) → opponent unhappy, mostly rejects
 *
 * Counter direction: AI pushes fields DOWN toward fair value (you're asking too much).
 */
export function evaluateOffer(params: {
  playerPayout: number;
  playerPpvSplit: number;
  gymBoxerRepIndex: number;
  opponentRepIndex: number;
  roundsUsed: number;
  random?: number;
}): AiDecision {
  const { playerPayout, playerPpvSplit, gymBoxerRepIndex, opponentRepIndex, roundsUsed } = params;
  const rand = params.random ?? Math.random();

  // repGap > 0 means opponent is bigger name → player should accept lower terms
  const repGap = opponentRepIndex - gymBoxerRepIndex; // -9..+9
  const fairPayout = 10_000 * (0.5 + ((9 - repGap) / 18) * 2.5);
  const fairPpvSplit = Math.min(90, Math.max(10, 50 - repGap * 3));

  const offerScore = (playerPayout / fairPayout) + (playerPpvSplit / fairPpvSplit);

  // Base probabilities: low score = good for opponent = accept
  let pAccept: number;
  let pCounter: number;
  // pReject = 1 - pAccept - pCounter

  if (offerScore <= 0.8) {
    pAccept = 1.0; pCounter = 0;
  } else if (offerScore <= 1.2) {
    pAccept = 0.8; pCounter = 0.2;
  } else if (offerScore <= 1.8) {
    pAccept = 0; pCounter = 0.9;
  } else {
    pAccept = 0; pCounter = 0.3;
  }

  // Round 3 modifier: +20% to reject, proportionally reduce others
  if (roundsUsed === 2) {
    const extraReject = Math.min(0.2, pAccept + pCounter);
    const scale = (pAccept + pCounter) > 0 ? (pAccept + pCounter - extraReject) / (pAccept + pCounter) : 0;
    pAccept = pAccept * scale;
    pCounter = pCounter * scale;
  }

  // Determine outcome
  let outcome: 'accept' | 'counter' | 'reject';
  if (rand < pAccept) {
    outcome = 'accept';
  } else if (rand < pAccept + pCounter) {
    outcome = 'counter';
  } else {
    outcome = 'reject';
  }

  if (outcome === 'accept') return { outcome: 'accept' };
  if (outcome === 'reject') return { outcome: 'reject' };

  // Counter: push fields DOWN toward fair value (player is demanding too much)
  const counterPayout = playerPayout > fairPayout
    ? snapToIncrementDown(playerPayout - (playerPayout - fairPayout) / 2)
    : null;
  const counterPpvSplit = playerPpvSplit > fairPpvSplit
    ? snapTo5Down(playerPpvSplit - (playerPpvSplit - fairPpvSplit) / 2)
    : null;

  return { outcome: 'counter', payout: counterPayout, ppvSplit: counterPpvSplit };
}

// --- Payout options ---

export function buildPayoutOptions(): number[] {
  const options: number[] = [];
  for (let v = 1_000; v <= 10_000; v += 1_000) options.push(v);
  for (let v = 20_000; v <= 100_000; v += 10_000) options.push(v);
  for (let v = 200_000; v <= 1_000_000; v += 100_000) options.push(v);
  return options;
}

// --- Reputation index ---

const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 1,
  'Rising Star': 2,
  'Respectable Opponent': 3,
  'Contender': 4,
  'Championship Caliber': 5,
  'Nationally Ranked': 6,
  'World Class Fighter': 7,
  'International Superstar': 8,
  'All-Time Great': 9,
};

// --- Page data ---

interface PageData {
  contract: FightContract;
  gymBoxer: Boxer;
  opponent: Boxer;
  federation: Federation | undefined;
}

export default function ContractNegotiation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PageData | null>(null);
  const [offerPayout, setOfferPayout] = useState<number>(1_000);
  const [offerPpvSplit, setOfferPpvSplit] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fightScheduled, setFightScheduled] = useState(false);
  const fightScheduledRef = useRef(false);

  const payoutOptions = buildPayoutOptions();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const contractId = id ? parseInt(id, 10) : NaN;
      if (isNaN(contractId)) {
        setLoadError('Invalid contract ID.');
        return;
      }
      const contract = await getFightContract(contractId);
      // If we just accepted this contract in the same session, don't redirect — show success state
      if (!contract || (contract.status === 'accepted' && !fightScheduledRef.current) || contract.status === 'completed') {
        if (!cancelled) navigate('/league/calendar', { replace: true });
        return;
      }
      const [gymBoxer, opponent, federation] = await Promise.all([
        getBoxer(contract.boxerId),
        getBoxer(contract.opponentId),
        contract.federationId != null ? getFederation(contract.federationId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      if (!gymBoxer || !opponent) {
        setLoadError('Boxer data not found.');
        return;
      }

      if (contract.status === 'countered') {
        setOfferPayout(contract.counterOfferPayout ?? contract.guaranteedPayout ?? 1_000);
        setOfferPpvSplit(contract.counterOfferPpvSplit ?? contract.ppvSplitPercentage ?? 50);
      }

      setData({ contract, gymBoxer, opponent, federation });
    }
    load();
    return () => { cancelled = true; };
  }, [id, navigate]);

  async function handleCancel() {
    if (!data?.contract?.id) { navigate('/league/schedule'); return; }
    await deleteFightContract(data.contract.id);
    navigate(`/league/schedule?boxerId=${data.contract.boxerId}`);
  }

  async function handleSubmit() {
    if (!data || submitting) return;
    const { contract, gymBoxer, opponent } = data;
    if (contract.id === undefined) return;

    setSubmitting(true);
    try {
      const newRoundsUsed = (contract.roundsUsed ?? 0) + 1;
      const decision = evaluateOffer({
        playerPayout: offerPayout,
        playerPpvSplit: offerPpvSplit,
        gymBoxerRepIndex: REPUTATION_INDEX[gymBoxer.reputation],
        opponentRepIndex: REPUTATION_INDEX[opponent.reputation],
        roundsUsed: newRoundsUsed - 1,
      });

      if (decision.outcome === 'accept') {
        const fightId = await putFight({
          date: contract.scheduledDate!,
          federationId: contract.federationId,
          weightClass: contract.weightClass,
          boxerIds: [contract.boxerId, contract.opponentId],
          winnerId: null,
          method: 'Decision',
          finishingMove: null,
          round: null,
          time: null,
          isTitleFight: contract.isTitleFight,
          contractId: contract.id,
        });
        await putFightContract({
          ...contract,
          status: 'accepted',
          guaranteedPayout: offerPayout,
          ppvSplitPercentage: offerPpvSplit,
          fightId,
          roundsUsed: newRoundsUsed,
        });
        await putCalendarEvent({ type: 'fight', date: contract.scheduledDate!, boxerIds: [contract.boxerId], fightId });
        await putCalendarEvent({ type: 'fight', date: contract.scheduledDate!, boxerIds: [contract.opponentId], fightId });
        const fedEvents = await getFederationEventsByFederation(contract.federationId);
        const matchingEvent = fedEvents.find(e => e.date === contract.scheduledDate);
        if (matchingEvent?.id !== undefined) {
          await updateFederationEventFights(matchingEvent.id, fightId);
        }
        fightScheduledRef.current = true;
        setFightScheduled(true);

      } else if (decision.outcome === 'counter' && newRoundsUsed < 3) {
        await putFightContract({
          ...contract,
          status: 'countered',
          roundsUsed: newRoundsUsed,
          counterOfferPayout: decision.payout,
          counterOfferPpvSplit: decision.ppvSplit,
        });
        setOfferPayout(decision.payout ?? offerPayout);
        setOfferPpvSplit(decision.ppvSplit ?? offerPpvSplit);
        setData(prev => prev ? {
          ...prev,
          contract: {
            ...prev.contract,
            status: 'countered',
            roundsUsed: newRoundsUsed,
            counterOfferPayout: decision.payout,
            counterOfferPpvSplit: decision.ppvSplit,
          },
        } : prev);

      } else {
        await deleteFightContract(contract.id);
        navigate(`/league/schedule?boxerId=${contract.boxerId}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contract Negotiation" subtitle="" />
        <p className={styles.error}>{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contract Negotiation" subtitle="" />
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  if (fightScheduled) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contract Negotiation" subtitle="" />
        <div className={styles.successBox}>
          <strong>Fight scheduled!</strong> Your contract has been signed.
          <div style={{ marginTop: 14 }}>
            <button className={styles.primaryBtn} onClick={() => navigate('/league/calendar')}>
              Go to Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { contract, gymBoxer, opponent, federation } = data;
  const roundsUsed = contract.roundsUsed ?? 0;
  const submitLabel = roundsUsed === 0 ? 'Submit Offer' : roundsUsed === 1 ? 'Counter' : 'Final Offer';

  const subtitle = [
    gymBoxer.name,
    'vs',
    opponent.name,
    federation ? `· ${federation.name}` : '',
    contract.scheduledDate ? `· ${contract.scheduledDate}` : '',
    `· ${contract.weightClass}`,
  ].filter(Boolean).join(' ');

  const counterPayoutDisplay = contract.counterOfferPayout ?? contract.guaranteedPayout;
  const counterPpvDisplay = contract.counterOfferPpvSplit ?? contract.ppvSplitPercentage;

  return (
    <div className={styles.page}>
      <PageHeader title="Contract Negotiation" subtitle={subtitle} />

      {contract.status === 'pending' && (
        <div className={styles.statusBox}>
          Make your opening offer.
        </div>
      )}
      {contract.status === 'countered' && (
        <div className={styles.statusBox}>
          <strong>Opponent counters:</strong> ${counterPayoutDisplay?.toLocaleString()} guaranteed / {counterPpvDisplay}% PPV split.{' '}
          Round {roundsUsed + 1} of 3.
        </div>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="payout">Your Guaranteed Payout</label>
          <select
            id="payout"
            value={offerPayout}
            onChange={e => setOfferPayout(Number(e.target.value))}
          >
            {payoutOptions.map(v => (
              <option key={v} value={v}>${v.toLocaleString()}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="ppvSplit">Your PPV Split %</label>
          <input
            id="ppvSplit"
            type="number"
            min={0}
            max={100}
            step={5}
            value={offerPpvSplit}
            onChange={e => setOfferPpvSplit(Math.min(100, Math.max(0, Number(e.target.value))))}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : submitLabel}
        </button>
        <button
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
