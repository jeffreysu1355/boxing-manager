import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import {
  GYM_LEVEL_COACH_CAP,
  COACH_HIRING_FEE,
  type Coach,
  type CoachSkillLevel,
  type Gym,
} from '../../db/db';
import { COACH_SKILL_INDEX, GYM_LEVEL_MAX_COACH_SKILL } from '../Gym/Coaches';
import styles from './CoachRecruiting.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function CoachRecruiting() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [pool, setPool] = useState<Coach[]>([]);
  const [hiredCount, setHiredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gymData, allCoaches] = await Promise.all([getGym(), getAllCoaches()]);
      if (!cancelled) {
        const gymId = gymData?.id ?? 1;
        const gymLevel = gymData?.level ?? 1;
        const maxSkillIdx = COACH_SKILL_INDEX[GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local'];
        const available = allCoaches.filter(
          c => c.gymId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxSkillIdx
        );
        const hired = allCoaches.filter(c => c.gymId === gymId).length;
        setGym(gymData ?? null);
        setPool(available);
        setHiredCount(hired);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleHire(coach: Coach) {
    if (!gym || !coach.id) return;
    const gymId = gym.id ?? 1;
    const gymLevel = gym.level ?? 1;
    const cap = GYM_LEVEL_COACH_CAP[gymLevel] ?? 5;
    const fee = COACH_HIRING_FEE[coach.skillLevel];
    if (hiredCount >= cap || gym.balance < fee) return;

    const updatedGym: Gym = { ...gym, balance: gym.balance - fee };
    const updatedCoach: Coach = { ...coach, gymId };

    await Promise.all([saveGym(updatedGym), putCoach(updatedCoach)]);

    setGym(updatedGym);
    setPool(prev => prev.filter(c => c.id !== coach.id));
    setHiredCount(prev => prev + 1);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Coach Recruiting" subtitle="Hire coaches to train your boxers" />
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  const gymLevel = gym?.level ?? 1;
  const cap = GYM_LEVEL_COACH_CAP[gymLevel] ?? 5;
  const atCap = hiredCount >= cap;

  return (
    <div>
      <PageHeader title="Coach Recruiting" subtitle="Hire coaches to train your boxers" />
      <div className={styles.page}>
        <div className={styles.balanceCallout}>
          Gym Balance: <strong>{formatMoney(gym?.balance ?? 0)}</strong>
        </div>
        <div className={styles.coachCountCallout}>
          Coaches: <strong className={atCap ? styles.atCap : undefined}>{hiredCount} / {cap}</strong>
        </div>

        {pool.length === 0 ? (
          <p className={styles.empty}>No coaches available at your gym level.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Skill Level</th>
                <th>Style</th>
                <th>Monthly Salary</th>
                <th>Hiring Fee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pool.map(coach => {
                const fee = COACH_HIRING_FEE[coach.skillLevel];
                const canAfford = (gym?.balance ?? 0) >= fee;
                const disabled = atCap || !canAfford;
                const title = atCap ? 'Roster full'
                  : !canAfford ? 'Insufficient funds'
                  : undefined;
                return (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
                    <td>{formatMoney(coach.monthlySalary)}/mo</td>
                    <td>{formatMoney(fee)}</td>
                    <td>
                      <button
                        className={styles.hireBtn}
                        disabled={disabled}
                        title={title}
                        onClick={() => handleHire(coach)}
                      >
                        Hire
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
