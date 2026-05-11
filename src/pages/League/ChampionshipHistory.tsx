import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllTitles } from '../../db/titleStore';
import { getAllFederations } from '../../db/federationStore';
import { getBoxer } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import type { Title, Federation, Boxer, WeightClass } from '../../db/db';
import { FEDERATION_ABBR } from '../../constants/federations';
import styles from './ChampionshipHistory.module.css';

const WEIGHT_CLASS_ORDER: WeightClass[] = [
  'flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diffDays(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

interface FedGroup {
  federation: Federation;
  titles: Title[];
}

export default function ChampionshipHistory() {
  const [fedGroups, setFedGroups] = useState<FedGroup[]>([]);
  const [boxerMap, setBoxerMap] = useState<Map<number, Boxer>>(new Map());
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [titles, federations, gym] = await Promise.all([
        getAllTitles(),
        getAllFederations(),
        getGym(),
      ]);

      // Collect all unique boxer IDs across all reigns
      const boxerIds = new Set<number>();
      for (const title of titles) {
        for (const reign of title.reigns) {
          boxerIds.add(reign.boxerId);
        }
      }

      const boxers = await Promise.all([...boxerIds].map(id => getBoxer(id)));
      const map = new Map<number, Boxer>();
      for (const b of boxers) {
        if (b && b.id !== undefined) map.set(b.id, b);
      }

      // Sort federations: prestige desc, IBF last
      federations.sort((a, b) => {
        if (a.name === 'International Boxing Federation') return 1;
        if (b.name === 'International Boxing Federation') return -1;
        return b.prestige - a.prestige;
      });

      // Group titles by federation, sorted by weight class order
      const groups: FedGroup[] = federations.map(fed => {
        const fedTitles = titles
          .filter(t => t.federationId === fed.id)
          .sort((a, b) =>
            WEIGHT_CLASS_ORDER.indexOf(a.weightClass) - WEIGHT_CLASS_ORDER.indexOf(b.weightClass)
          );
        return { federation: fed, titles: fedTitles };
      }).filter(g => g.titles.length > 0);

      if (cancelled) return;
      setFedGroups(groups);
      setBoxerMap(map);
      setToday(gym?.currentDate ?? '');
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Championship History" subtitle="All title reigns by federation" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Championship History" subtitle="All title reigns by federation" />
      <div className={styles.page}>
        {fedGroups.map(({ federation, titles }) => {
          const abbr = FEDERATION_ABBR[federation.name] ?? federation.name;
          return (
            <div key={federation.id} className={styles.fedSection}>
              <h2 className={styles.fedTitle}>{federation.name}</h2>
              {titles.map(title => {
                const cardTitle = `${abbr} ${capitalize(title.weightClass)} Championship`;
                // Reverse so newest reign is first
                const reigns = [...title.reigns].reverse();
                return (
                  <div
                    key={title.id}
                    id={`title-${title.id}`}
                    className={styles.titleCard}
                  >
                    <div className={styles.cardHeader}>{cardTitle}</div>
                    {reigns.length === 0 ? (
                      <p className={styles.empty}>No recorded reigns yet.</p>
                    ) : (
                      <>
                        <div className={styles.reignHeader}>
                          <span>Boxer</span>
                          <span>Date Won</span>
                          <span>Date Lost</span>
                          <span>Days</span>
                          <span>Defenses</span>
                        </div>
                        {reigns.map((reign, i) => {
                          const boxer = boxerMap.get(reign.boxerId);
                          const isCurrent = reign.dateLost === null;
                          const dateLostDisplay = isCurrent ? today : reign.dateLost!;
                          const days = diffDays(reign.dateWon, dateLostDisplay);
                          const rowClass = isCurrent ? styles.reignCurrent : styles.reignRow;
                          const boxerName = boxer?.name ?? 'Unknown Boxer';

                          return (
                            <div key={i} className={rowClass}>
                              <span>
                                {boxer?.id !== undefined ? (
                                  <Link to={`/player/${boxer.id}`} className={styles.boxerLink}>
                                    {boxerName}
                                  </Link>
                                ) : boxerName}
                              </span>
                              <span>{reign.dateWon}</span>
                              <span>
                                {isCurrent
                                  ? <span className={styles.currentBadge}>Current</span>
                                  : reign.dateLost}
                              </span>
                              <span>{days}</span>
                              <span>{reign.defenseCount}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
