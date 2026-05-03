import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import { getAllBoxers } from '../../db/boxerStore';
import type { Boxer, Coach, CoachSkillLevel, Gym } from '../../db/db';
import styles from './Coaches.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

export const COACH_SKILL_INDEX: Record<CoachSkillLevel, number> = {
  'local': 0,
  'contender': 1,
  'championship-caliber': 2,
  'all-time-great': 3,
};

export const GYM_LEVEL_MAX_COACH_SKILL: Record<number, CoachSkillLevel> = {
  1: 'local', 2: 'local', 3: 'local',
  4: 'contender', 5: 'contender', 6: 'contender',
  7: 'championship-caliber', 8: 'championship-caliber', 9: 'championship-caliber',
  10: 'all-time-great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function Coaches() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gymData, allCoaches, allBoxers] = await Promise.all([
        getGym(),
        getAllCoaches(),
        getAllBoxers(),
      ]);
      if (!cancelled) {
        const gymId = gymData?.id ?? 1;
        const gymRoster = allBoxers.filter(b => b.gymId === gymId);
        const hiredCoaches = allCoaches.filter(c => c.gymId === gymId);
        setRoster(gymRoster);
        setCoaches(hiredCoaches);
        setGym(gymData ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAssign(boxer: Boxer, coachIdStr: string) {
    const updated = [...coaches];

    const prevIdx = updated.findIndex(c => c.assignedBoxerId === boxer.id);
    if (prevIdx !== -1) {
      const prev = { ...updated[prevIdx], assignedBoxerId: null };
      updated[prevIdx] = prev;
      await putCoach(prev);
    }

    if (coachIdStr !== '') {
      const newCoachId = Number(coachIdStr);
      const newIdx = updated.findIndex(c => c.id === newCoachId);
      if (newIdx !== -1) {
        const next = { ...updated[newIdx], assignedBoxerId: boxer.id! };
        updated[newIdx] = next;
        await putCoach(next);
      }
    }

    setCoaches(updated);
  }

  async function handleRelease(coach: Coach) {
    const released = { ...coach, gymId: null as null, assignedBoxerId: null as null };
    await putCoach(released);
    setCoaches(prev => prev.filter(c => c.id !== coach.id));
  }

  const gymLevel = gym?.level ?? 1;
  const maxSkillIdx = COACH_SKILL_INDEX[GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local'];
  const unassigned = coaches.filter(c => c.assignedBoxerId === null);

  if (loading) {
    return (
      <div>
        <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
      <div className={styles.page}>

        <section>
          <h2 className={styles.sectionTitle}>Roster</h2>
          {roster.length === 0 ? (
            <p className={styles.empty}>No boxers on your roster yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Style</th>
                  <th>Reputation</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(boxer => {
                  const assignedCoach = coaches.find(c => c.assignedBoxerId === boxer.id);
                  return (
                    <tr key={boxer.id}>
                      <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                      <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                      <td>{boxer.reputation}</td>
                      <td>
                        <select
                          className={styles.coachSelect}
                          value={assignedCoach?.id?.toString() ?? ''}
                          onChange={e => handleAssign(boxer, e.target.value)}
                        >
                          <option value="">None</option>
                          {coaches
                            .filter(c =>
                              COACH_SKILL_INDEX[c.skillLevel] <= maxSkillIdx ||
                              c.assignedBoxerId === boxer.id
                            )
                            .map(coach => (
                              <option key={coach.id} value={coach.id?.toString()}>
                                {coach.name} ({SKILL_LABELS[coach.skillLevel]})
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Unassigned Coaches</h2>
          {unassigned.length === 0 ? (
            <p className={styles.empty}>All hired coaches are assigned.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Skill Level</th>
                  <th>Style</th>
                  <th>Monthly Salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map(coach => (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
                    <td>{formatMoney(coach.monthlySalary)}/mo</td>
                    <td>
                      <button
                        className={styles.releaseBtn}
                        onClick={() => handleRelease(coach)}
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

      </div>
    </div>
  );
}
