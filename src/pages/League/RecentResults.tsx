import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllFights } from '../../db/fightStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllFederations } from '../../db/federationStore';
import { getGym } from '../../db/gymStore';
import type { Fight, Boxer, Federation } from '../../db/db';
import styles from './RecentResults.module.css';

interface ResultRow {
  fight: Fight;
  boxer1: Boxer | undefined;
  boxer2: Boxer | undefined;
  federationName: string;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RecentResults() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gym, allFights, allBoxers, allFeds] = await Promise.all([
        getGym(),
        getAllFights(),
        getAllBoxers(),
        getAllFederations(),
      ]);

      if (cancelled) return;

      const currentDate = gym?.currentDate ?? '2026-01-01';
      const [cy, cm, cd] = currentDate.split('-').map(Number);
      const cutoffMs = new Date(cy, cm - 1, cd).getTime() - 365 * 86_400_000;

      const boxerMap = new Map<number, Boxer>(
        allBoxers.filter(b => b.id !== undefined).map(b => [b.id!, b])
      );
      const fedMap = new Map<number, Federation>(
        allFeds.filter(f => f.id !== undefined).map(f => [f.id!, f])
      );

      const npcFights = allFights
        .filter(f => {
          if (f.contractId !== null) return false;
          const [fy, fm, fd] = f.date.split('-').map(Number);
          return new Date(fy, fm - 1, fd).getTime() >= cutoffMs;
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      const built: ResultRow[] = npcFights.map(fight => ({
        fight,
        boxer1: fight.boxerIds[0] !== undefined ? boxerMap.get(fight.boxerIds[0]) : undefined,
        boxer2: fight.boxerIds[1] !== undefined ? boxerMap.get(fight.boxerIds[1]) : undefined,
        federationName:
          fight.federationId !== -1
            ? (fedMap.get(fight.federationId)?.name ?? 'Unknown Federation')
            : 'Cross-Federation',
      }));

      setRows(built);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Recent Results" subtitle="NPC fight results from the past year" />
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Recent Results" subtitle="NPC fight results from the past year" />
      <div className={styles.page}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No results yet. Simulate time forward to see NPC fights.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Fighter A</th>
                <th>Fighter B</th>
                <th>Winner</th>
                <th>Method</th>
                <th>Weight Class</th>
                <th>Federation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ fight, boxer1, boxer2, federationName }) => {
                const winner = fight.winnerId === boxer1?.id ? boxer1
                             : fight.winnerId === boxer2?.id ? boxer2
                             : undefined;
                return (
                  <tr key={fight.id}>
                    <td>{formatDate(fight.date)}</td>
                    <td>
                      {boxer1
                        ? <Link to={`/player/${boxer1.id}`}>{boxer1.name}</Link>
                        : 'Unknown'}
                    </td>
                    <td>
                      {boxer2
                        ? <Link to={`/player/${boxer2.id}`}>{boxer2.name}</Link>
                        : 'Unknown'}
                    </td>
                    <td className={styles.winner}>
                      {winner
                        ? <Link to={`/player/${winner.id}`}>{winner.name}</Link>
                        : '—'}
                    </td>
                    <td>{fight.method}</td>
                    <td>{fight.weightClass}</td>
                    <td>{federationName}</td>
                    <td>
                      {fight.isTitleFight && (
                        <span className={styles.titleBadge}>Title Fight</span>
                      )}
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
