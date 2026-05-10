import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import { logTransaction, getAllTransactions } from '../../db/transactionStore';
import type { Gym, GymTransaction } from '../../db/db';
import styles from './Finances.module.css';

const UPGRADE_COSTS: Record<number, number> = {
  1: 10_000,
  2: 25_000,
  3: 75_000,
  4: 200_000,
  5: 500_000,
  6: 1_500_000,
  7: 5_000_000,
  8: 15_000_000,
  9: 78_000_000,
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`;
}

export default function Finances() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [transactions, setTransactions] = useState<GymTransaction[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGym(), getAllTransactions()]).then(([g, txs]) => {
      if (!cancelled) {
        setGym(g ?? null);
        setTransactions(txs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleConfirmUpgrade() {
    if (!gym) return;
    const cost = UPGRADE_COSTS[gym.level];
    if (cost === undefined || gym.balance < cost) return;

    await logTransaction({
      date: gym.currentDate,
      description: `Gym upgrade to Level ${gym.level + 1}`,
      amount: -cost,
      category: 'gym_upgrade',
    });

    // logTransaction already updated gym.balance in DB; now bump the level
    const fresh = await getGym();
    if (!fresh) return;
    await saveGym({ ...fresh, level: gym.level + 1 });
    setGym({ ...fresh, level: gym.level + 1 });
    setConfirming(false);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Finances" subtitle="Gym level and financial overview" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div>
        <PageHeader title="Finances" subtitle="Gym level and financial overview" />
        <p className={styles.loading}>No gym data found. Try resetting the game.</p>
      </div>
    );
  }

  const upgradeCost = UPGRADE_COSTS[gym.level];
  const canAfford = upgradeCost !== undefined && gym.balance >= upgradeCost;
  const shortfall = upgradeCost !== undefined ? upgradeCost - gym.balance : 0;

  return (
    <div>
      <PageHeader title="Finances" subtitle="Gym level and financial overview" />
      <div className={styles.page}>
        <div className={styles.card}>
          <div>
            <span className={styles.gymName}>{gym.name}</span>
            <span className={styles.levelBadge}>Level {gym.level} / 10</span>
          </div>

          <div>
            <div className={styles.balanceLabel}>Balance</div>
            <div className={styles.balance}>{formatMoney(gym.balance)}</div>
          </div>

          <div className={styles.upgradeBlock}>
            {gym.level >= 10 ? (
              <span className={styles.maxLevel}>Max Level</span>
            ) : confirming ? (
              <div className={styles.confirmBlock}>
                <p className={styles.confirmText}>
                  Upgrade to Level {gym.level + 1} for {formatMoney(upgradeCost!)}? This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.confirmBtn} onClick={handleConfirmUpgrade}>
                    Confirm
                  </button>
                  <button className={styles.cancelBtn} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.upgradeLabel}>
                  Upgrade to Level {gym.level + 1} — {formatMoney(upgradeCost!)}
                </span>
                <button
                  className={styles.upgradeBtn}
                  disabled={!canAfford}
                  title={!canAfford ? `Requires ${formatMoney(upgradeCost!)} — you are ${formatMoney(shortfall)} short` : undefined}
                  onClick={() => setConfirming(true)}
                >
                  Upgrade
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={styles.historySection}>
        <div className={styles.historySectionTitle}>Transaction History</div>
        {transactions.length === 0 ? (
          <p className={styles.empty}>No transactions yet.</p>
        ) : (
          <div className={styles.historyList}>
            {transactions.map(tx => (
              <div key={tx.id} className={styles.historyRow}>
                <span className={styles.historyDate}>{formatDate(tx.date)}</span>
                <span className={styles.historyDesc}>{tx.description}</span>
                <span className={`${styles.historyAmount} ${tx.amount >= 0 ? styles.historyIncome : styles.historyExpense}`}>
                  {formatAmount(tx.amount)}
                </span>
                <span className={styles.historyBalance}>{formatMoney(tx.balanceAfter)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
