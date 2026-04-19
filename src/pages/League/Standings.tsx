import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllFederations } from '../../db/federationStore';
import { getTitlesByFederation } from '../../db/titleStore';
import { getBoxersByFederation, getBoxer } from '../../db/boxerStore';
import type { Federation, Title, Boxer, ReputationLevel } from '../../db/db';
import styles from './Standings.module.css';

const REPUTATION_ORDER: ReputationLevel[] = [
  'All-Time Great',
  'International Superstar',
  'World Class Fighter',
  'Nationally Ranked',
  'Championship Caliber',
  'Contender',
  'Respectable Opponent',
  'Rising Star',
  'Local Star',
  'Unknown',
];

function repRank(r: ReputationLevel): number {
  return REPUTATION_ORDER.indexOf(r);
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

interface FedData {
  federation: Federation;
  title: Title | null;
  champion: Boxer | null;
  boxers: Boxer[];
}

export default function Standings() {
  const [fedData, setFedData] = useState<FedData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const federations = await getAllFederations();
      // Sort: IBF last (most prestigious), others by prestige desc
      federations.sort((a, b) => {
        if (a.name === 'International Boxing Federation') return 1;
        if (b.name === 'International Boxing Federation') return -1;
        return b.prestige - a.prestige;
      });

      const results: FedData[] = await Promise.all(
        federations.map(async fed => {
          const [titles, boxers] = await Promise.all([
            getTitlesByFederation(fed.id!),
            getBoxersByFederation(fed.id!),
          ]);

          const title = titles[0] ?? null;
          const champion = title?.currentChampionId != null
            ? await getBoxer(title.currentChampionId) ?? null
            : null;

          boxers.sort((a, b) => repRank(a.reputation) - repRank(b.reputation));

          return { federation: fed, title, champion, boxers };
        })
      );

      if (!cancelled) {
        setFedData(results);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Standings" subtitle="Title holders and contender rankings by federation" />
        <p className={styles.loading}>Loading standings…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Standings" subtitle="Title holders and contender rankings by federation" />
      <div className={styles.page}>
        {fedData.map(({ federation, title, champion, boxers }) => (
          <div key={federation.id} className={styles.federation}>
            <div className={styles.fedHeader}>
              <span className={styles.fedName}>{federation.name}</span>
              <span className={styles.fedPrestige}>Prestige {federation.prestige}/10</span>
            </div>

            <div className={styles.weightSection}>
              <div className={styles.weightLabel}>Welterweight</div>

              {!title && (
                <p className={styles.vacant}>No title data</p>
              )}

              {boxers.length === 0 && (
                <p className={styles.vacant}>No fighters</p>
              )}

              {boxers.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Style</th>
                      <th>Reputation</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxers.map((boxer, i) => {
                      const isChamp = champion?.id === boxer.id;
                      return (
                        <tr key={boxer.id} className={isChamp ? styles.champion : undefined}>
                          <td>{i + 1}</td>
                          <td>
                            <Link to={`/player/${boxer.id}`}>{boxer.name}</Link>
                            {isChamp && <span className={styles.championBadge}>Champ</span>}
                          </td>
                          <td>{boxer.age}</td>
                          <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                          <td>{boxer.reputation}</td>
                          <td className={styles.record}>{calcRecord(boxer)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
