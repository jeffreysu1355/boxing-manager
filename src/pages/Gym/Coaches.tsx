import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import { getAllBoxers } from '../../db/boxerStore';
import type { Boxer, Coach, CoachSkillLevel } from '../../db/db';
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

export default function Coaches() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [gymLevel, setGymLevel] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allCoaches, allBoxers] = await Promise.all([
        getGym(),
        getAllCoaches(),
        getAllBoxers(),
      ]);
      if (!cancelled) {
        const gymRoster = allBoxers.filter(b => b.gymId === (gym?.id ?? 1));
        setRoster(gymRoster);
        setCoaches(allCoaches);
        setGymLevel(gym?.level ?? 1);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAssign(boxer: Boxer, coachIdStr: string) {
    const updatedCoaches = [...coaches];

    // Clear any existing coach assigned to this boxer
    const prevCoachIdx = updatedCoaches.findIndex(c => c.assignedBoxerId === boxer.id);
    if (prevCoachIdx !== -1) {
      const prev = { ...updatedCoaches[prevCoachIdx], assignedBoxerId: null };
      updatedCoaches[prevCoachIdx] = prev;
      await putCoach(prev);
    }

    if (coachIdStr !== '') {
      const newCoachId = Number(coachIdStr);
      const newCoachIdx = updatedCoaches.findIndex(c => c.id === newCoachId);
      if (newCoachIdx !== -1) {
        const updated = { ...updatedCoaches[newCoachIdx], assignedBoxerId: boxer.id! };
        updatedCoaches[newCoachIdx] = updated;
        await putCoach(updated);
      }
    }

    setCoaches(updatedCoaches);
  }

  const maxCoachSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
  const maxCoachSkillIdx = COACH_SKILL_INDEX[maxCoachSkill];
  const availableCoaches = coaches.filter(
    c => c.assignedBoxerId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxCoachSkillIdx
  );

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
                              COACH_SKILL_INDEX[c.skillLevel] <= maxCoachSkillIdx ||
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
          <h2 className={styles.sectionTitle}>Available Coaches</h2>
          {availableCoaches.length === 0 ? (
            <p className={styles.empty}>No coaches available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Skill Level</th>
                  <th>Style</th>
                </tr>
              </thead>
              <tbody>
                {availableCoaches.map(coach => (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
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
