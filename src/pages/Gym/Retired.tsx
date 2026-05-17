import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllBoxers } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import type { Boxer } from '../../db/db';
import { calcRecord, capitalize, styleLabel } from './Roster';

export default function Retired() {
  const [retired, setRetired] = useState<Boxer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gym, allBoxers] = await Promise.all([getGym(), getAllBoxers()]);
      const gymId = gym?.id ?? 1;
      setRetired(allBoxers.filter(b => b.gymId === gymId && b.retired === true));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Retired" subtitle="Alumni of your gym" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Retired" subtitle="Alumni of your gym" />
      {retired.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>No retired boxers yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Weight Class</th>
              <th>Style</th>
              <th>Record</th>
              <th>Reputation</th>
            </tr>
          </thead>
          <tbody>
            {retired.map(boxer => (
              <tr key={boxer.id}>
                <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                <td>{boxer.age}</td>
                <td>{capitalize(boxer.weightClass)}</td>
                <td>{styleLabel(boxer.style)}</td>
                <td>{calcRecord(boxer.record)}</td>
                <td>{boxer.reputation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
