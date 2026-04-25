import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllBoxers } from '../../db/boxerStore';
import { putBoxer } from '../../db/boxerStore';
import { getGym, saveGym } from '../../db/gymStore';
import type { Boxer, Gym, ReputationLevel } from '../../db/db';
import styles from './Recruiting.module.css';

const SIGNING_BONUS: Record<ReputationLevel, number> = {
  'Unknown':               1000,
  'Local Star':            3000,
  'Rising Star':           8000,
  'Respectable Opponent':  20000,
  'Contender':             50000,
  'Championship Caliber':  0,
  'Nationally Ranked':     0,
  'World Class Fighter':   0,
  'International Superstar': 0,
  'All-Time Great':        0,
};

export const GYM_LEVEL_MAX_REP: Record<number, number> = {
  1: 0, 2: 0,   // Unknown only (index 0)
  3: 1, 4: 1,   // Local Star (index 1)
  5: 2, 6: 2, 7: 2,  // Rising Star (index 2)
  8: 4, 9: 4, 10: 4, // Respectable Opponent + Contender (index 4)
};

export const REPUTATION_INDEX: Record<ReputationLevel, number> = {
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

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function calcRecord(boxer: Boxer): string {
  const wins = boxer.record.filter(r => r.result === 'win').length;
  const losses = boxer.record.filter(r => r.result === 'loss').length;
  return `${wins}-${losses}`;
}

function styleLabel(style: Boxer['style']): string {
  return style
    .split('-')
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('-');
}

export default function Recruiting() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [prospects, setProspects] = useState<Boxer[]>([]);
  const [freeAgents, setFreeAgents] = useState<Boxer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gymData, allBoxers] = await Promise.all([getGym(), getAllBoxers()]);

      if (!cancelled) {
        const pool = allBoxers.filter(b => b.gymId === null && b.federationId === null);
        const prospectList = pool.filter(b => b.age < 18);
        const freeAgentList = pool.filter(b => b.age >= 18);

        const gymLevel = gymData?.level ?? 1;
        const maxRepIndex = GYM_LEVEL_MAX_REP[gymLevel] ?? 0;
        const visibleFreeAgents = freeAgentList.filter(
          b => REPUTATION_INDEX[b.reputation] <= maxRepIndex
        );

        setGym(gymData ?? null);
        setProspects(prospectList);
        setFreeAgents(visibleFreeAgents);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function handleRecruit(boxer: Boxer) {
    if (!gym || !boxer.id) return;
    const bonus = SIGNING_BONUS[boxer.reputation];
    if (gym.balance < bonus) return;

    const updatedGym: Gym = { ...gym, balance: gym.balance - bonus, rosterIds: [...gym.rosterIds, boxer.id] };
    const updatedBoxer: Boxer = { ...boxer, gymId: gym.id ?? 1 };

    await Promise.all([saveGym(updatedGym), putBoxer(updatedBoxer)]);

    setGym(updatedGym);
    setProspects(prev => prev.filter(b => b.id !== boxer.id));
    setFreeAgents(prev => prev.filter(b => b.id !== boxer.id));
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Recruiting" subtitle="Sign prospects and free agents to your gym" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Recruiting" subtitle="Sign prospects and free agents to your gym" />
      <div className={styles.page}>
        <div className={styles.balanceCallout}>
          Gym Balance: <strong>{formatMoney(gym?.balance ?? 0)}</strong>
        </div>

        <section>
          <h2 className={styles.sectionTitle}>Prospects</h2>
          {prospects.length === 0 ? (
            <p className={styles.empty}>No prospects currently available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Style</th>
                  <th>Record</th>
                  <th>Signing Bonus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prospects.map(boxer => {
                  const bonus = SIGNING_BONUS[boxer.reputation];
                  const canAfford = (gym?.balance ?? 0) >= bonus;
                  return (
                    <tr key={boxer.id}>
                      <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                      <td>{boxer.age}</td>
                      <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                      <td>{calcRecord(boxer)}</td>
                      <td>{formatMoney(bonus)}</td>
                      <td>
                        <button
                          className={styles.recruitBtn}
                          disabled={!canAfford}
                          title={!canAfford ? 'Insufficient funds' : undefined}
                          onClick={() => handleRecruit(boxer)}
                        >
                          Recruit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Free Agents</h2>
          {freeAgents.length === 0 ? (
            <p className={styles.empty}>No free agents currently available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Style</th>
                  <th>Reputation</th>
                  <th>Record</th>
                  <th>Signing Bonus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {freeAgents.map(boxer => {
                  const bonus = SIGNING_BONUS[boxer.reputation];
                  const canAfford = (gym?.balance ?? 0) >= bonus;
                  return (
                    <tr key={boxer.id}>
                      <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                      <td>{boxer.age}</td>
                      <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                      <td>{boxer.reputation}</td>
                      <td>{calcRecord(boxer)}</td>
                      <td>{formatMoney(bonus)}</td>
                      <td>
                        <button
                          className={styles.recruitBtn}
                          disabled={!canAfford}
                          title={!canAfford ? 'Insufficient funds' : undefined}
                          onClick={() => handleRecruit(boxer)}
                        >
                          Recruit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
