import styles from './WatchlistFlag.module.css';

interface WatchlistFlagProps {
  isWatchlisted: boolean;
  isOwnGym: boolean;
  onToggle: () => void;
}

export function WatchlistFlag({ isWatchlisted, isOwnGym, onToggle }: WatchlistFlagProps) {
  if (!isWatchlisted) {
    return (
      <button
        type="button"
        className={styles.flag}
        title="Add to watchlist"
        onClick={onToggle}
      >
        ⚑
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.flagActive} ${isOwnGym ? styles.flagGreen : styles.flagRed}`}
      title="Remove from watchlist"
      onClick={onToggle}
    >
      🏴
    </button>
  );
}
