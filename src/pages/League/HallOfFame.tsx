import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllHofEntries } from '../../db/hallOfFameStore';
import type { HallOfFameEntry } from '../../db/db';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HallOfFame() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllHofEntries().then(all => {
      setEntries(all.sort((a, b) => b.score - a.score));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Hall of Fame" subtitle="Boxing legends" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Hall of Fame" subtitle="Boxing legends" />
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
          No boxers have been inducted into the Hall of Fame yet.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Weight Class</th>
              <th>Record</th>
              <th>Peak Reputation</th>
              <th>Career Span</th>
              <th>Titles</th>
              <th>Defenses</th>
              <th>HOF Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const { wins, losses, draws } = entry.record;
              const recordStr = draws > 0
                ? `${wins}-${losses}-${draws}`
                : `${wins}-${losses}`;
              return (
                <tr key={entry.id}>
                  <td>
                    <Link to={`/player/${entry.boxerId}`}>{entry.boxerName}</Link>
                  </td>
                  <td>{capitalize(entry.weightClass)}</td>
                  <td>{recordStr}</td>
                  <td>{entry.peakReputation}</td>
                  <td>{Math.floor(entry.careerSpan)} years</td>
                  <td>{entry.titlesWon}</td>
                  <td>{entry.totalDefenses}</td>
                  <td>{entry.score.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
