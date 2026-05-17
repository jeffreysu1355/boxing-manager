import styles from './WatchlistFlag.module.css';

interface WatchlistFlagProps {
  isWatchlisted: boolean;
  isOwnGym: boolean;
  onToggle: () => void;
}

function FlagIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 1v12M2 1h9l-2.5 4L11 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
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
        <FlagIcon />
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
      <FlagIcon />
    </button>
  );
}
