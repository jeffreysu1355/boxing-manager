import { PageHeader } from '../../components/PageHeader/PageHeader';
import { STYLE_FOCUS } from '../../lib/fightSim';
import { REPUTATION_ORDER, RANK_CONFIG } from '../../lib/rankSystem';
import type { FightingStyle, BoxerStats } from '../../db/db';
import styles from './InfoPage.module.css';

const STYLE_LABELS: Record<FightingStyle, string> = {
  'out-boxer':      'Out-Boxer',
  'swarmer':        'Swarmer',
  'slugger':        'Slugger',
  'counterpuncher': 'Counterpuncher',
};

const STAT_LABELS: Record<keyof BoxerStats, string> = {
  jab:          'Jab',
  cross:        'Cross',
  leadHook:     'Lead Hook',
  rearHook:     'Rear Hook',
  uppercut:     'Uppercut',
  headMovement: 'Head Movement',
  bodyMovement: 'Body Movement',
  guard:        'Guard',
  positioning:  'Positioning',
  timing:       'Timing',
  adaptability: 'Adaptability',
  discipline:   'Discipline',
  speed:        'Speed',
  power:        'Power',
  endurance:    'Endurance',
  recovery:     'Recovery',
  toughness:    'Toughness',
};

const STAT_GROUPS: { label: string; stats: (keyof BoxerStats)[] }[] = [
  { label: 'Offense',  stats: ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'] },
  { label: 'Defense',  stats: ['headMovement', 'bodyMovement', 'guard', 'positioning'] },
  { label: 'Mental',   stats: ['timing', 'adaptability', 'discipline'] },
  { label: 'Physical', stats: ['speed', 'power', 'endurance', 'recovery', 'toughness'] },
];

const STYLE_ORDER: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];

const COUNTER_CHAIN: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher', 'out-boxer'];

export default function InfoPage() {
  return (
    <div className={styles.page}>
      <PageHeader title="Game Info" subtitle="Reference guide for game mechanics" />

      {/* Fighting Styles */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Fighting Styles</div>
        <div className={styles.sectionBody}>
          {STYLE_ORDER.map(style => {
            const focusSet = new Set(STYLE_FOCUS[style]);
            return (
              <div key={style} className={styles.styleCard}>
                <div className={styles.styleCardHeader}>{STYLE_LABELS[style]}</div>
                <div className={styles.styleCardBody}>
                  {STAT_GROUPS.map(group => {
                    const focused = group.stats.filter(s => focusSet.has(s));
                    if (focused.length === 0) return null;
                    return (
                      <div key={group.label} className={styles.statGroup}>
                        <div className={styles.statGroupLabel}>{group.label}</div>
                        <div className={styles.statList}>
                          {focused.map(stat => (
                            <span key={stat} className={styles.statBadge}>
                              {STAT_LABELS[stat]}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Style Counters */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Style Counters</div>
        <div className={styles.sectionBody}>
          <div className={styles.counterChain}>
            {COUNTER_CHAIN.map((style, i) => (
              <span key={`${style}-${i}`}>
                {i > 0 && <span className={styles.counterArrow}> beats </span>}
                {STYLE_LABELS[style]}
              </span>
            ))}
            <span className={styles.counterArrow}>→ …</span>
          </div>
          <div className={styles.counterNote}>
            Each style has one counter. When a boxer's style counters their opponent's, they gain a fight advantage worth up to 10% of the outcome (style matchup contributes 20% total, split ±10%).
          </div>
        </div>
      </div>

      {/* Reputation Ladder */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Reputation Ladder</div>
        <div className={styles.sectionBody}>
          <table className={styles.reputationTable}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Reputation</th>
                <th>Points to Promote</th>
              </tr>
            </thead>
            <tbody>
              {[...REPUTATION_ORDER].reverse().map((rep, i) => {
                const rank = REPUTATION_ORDER.length - i;
                const config = RANK_CONFIG[rep];
                return (
                  <tr key={rep}>
                    <td className={styles.rankBadge}>{rank}</td>
                    <td>{rep}</td>
                    <td>
                      {config.promotionThreshold === Infinity
                        ? <span className={styles.maxTier}>Max tier</span>
                        : config.promotionThreshold}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
