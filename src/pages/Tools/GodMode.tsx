import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';

export default function GodMode() {
  const [godMode, setGodMode] = useState<boolean>(false);
  const [restarting, setRestarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    getGym().then(gym => {
      setGodMode(gym?.godModeEnabled ?? false);
      setLoading(false);
    });
  }, []);

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    try {
      const gym = await getGym();
      if (!gym) return;
      const next = !(gym.godModeEnabled ?? false);
      await saveGym({ ...gym, godModeEnabled: next });
      setGodMode(next);
    } finally {
      setToggling(false);
    }
  }

  async function handleRestart() {
    if (!confirm('This will wipe all data and start a fresh world. Continue?')) return;
    setRestarting(true);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('boxing-manager');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    window.location.href = '/';
  }

  async function handleImport() {
    setImportError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError('Please select a JSON file.');
      return;
    }
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setImportError('Invalid JSON file.');
      return;
    }

    if (
      typeof parsed !== 'object' || parsed === null ||
      (parsed as Record<string, unknown>).exportVersion !== 1
    ) {
      setImportError('Not a valid boxer export file (missing exportVersion: 1).');
      return;
    }

    const data = parsed as Record<string, unknown>;
    const boxer = data.boxer as Record<string, unknown> | undefined;

    if (!boxer) {
      setImportError('Missing boxer data in file.');
      return;
    }

    const VALID_WEIGHT_CLASSES = ['flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight'];
    const VALID_STYLES = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];
    const VALID_REPUTATIONS = [
      'Unknown', 'Local Star', 'Rising Star', 'Respectable Opponent', 'Contender',
      'Championship Caliber', 'Nationally Ranked', 'World Class Fighter',
      'International Superstar', 'All-Time Great',
    ];
    const REQUIRED_STATS = [
      'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
      'headMovement', 'bodyMovement', 'guard', 'positioning',
      'timing', 'adaptability', 'discipline',
      'speed', 'power', 'endurance', 'recovery', 'toughness',
    ];

    if (typeof boxer.name !== 'string' || !boxer.name.trim()) {
      setImportError('Invalid boxer: missing name.'); return;
    }
    if (!VALID_WEIGHT_CLASSES.includes(boxer.weightClass as string)) {
      setImportError('Invalid boxer: invalid weightClass.'); return;
    }
    if (!VALID_STYLES.includes(boxer.style as string)) {
      setImportError('Invalid boxer: invalid style.'); return;
    }
    if (!VALID_REPUTATIONS.includes(boxer.reputation as string)) {
      setImportError('Invalid boxer: invalid reputation.'); return;
    }
    if (typeof boxer.rankPoints !== 'number') {
      setImportError('Invalid boxer: missing rankPoints.'); return;
    }
    if (typeof boxer.demotionBuffer !== 'number') {
      setImportError('Invalid boxer: missing demotionBuffer.'); return;
    }
    if (!Array.isArray(boxer.naturalTalents)) {
      setImportError('Invalid boxer: naturalTalents must be an array.'); return;
    }
    if (!Array.isArray(boxer.injuries)) {
      setImportError('Invalid boxer: injuries must be an array.'); return;
    }
    if (!Array.isArray(boxer.titles)) {
      setImportError('Invalid boxer: titles must be an array.'); return;
    }
    if (!Array.isArray(boxer.record)) {
      setImportError('Invalid boxer: record must be an array.'); return;
    }
    const stats = boxer.stats as Record<string, unknown> | undefined;
    if (!stats || typeof stats !== 'object') {
      setImportError('Invalid boxer: missing stats.'); return;
    }
    for (const key of REQUIRED_STATS) {
      if (typeof stats[key] !== 'number') {
        setImportError(`Invalid boxer: missing stat "${key}".`); return;
      }
    }

    navigate('/player/import/edit', { state: { boxer } });
  }

  return (
    <div>
      <PageHeader title="God Mode" subtitle="Modify stats, natural talents, and history" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleToggle}
            disabled={loading || toggling}
            style={{
              padding: '6px 16px',
              background: godMode ? 'var(--success)' : 'var(--surface, #1a1a2e)',
              color: godMode ? '#000' : 'var(--text-primary)',
              border: '1px solid ' + (godMode ? 'var(--success)' : 'var(--border)'),
              borderRadius: 3,
              fontWeight: 600,
              cursor: (loading || toggling) ? 'not-allowed' : 'pointer',
              opacity: (loading || toggling) ? 0.5 : 1,
              minWidth: 120,
            }}
          >
            God Mode: {godMode ? 'ON' : 'OFF'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {godMode ? 'Edit buttons are visible on player pages.' : 'Enable to unlock boxer editing.'}
          </span>
        </div>
        <button
          onClick={handleRestart}
          disabled={restarting}
          style={{
            padding: '6px 16px',
            background: 'var(--danger)',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            fontWeight: 600,
            cursor: restarting ? 'not-allowed' : 'pointer',
            opacity: restarting ? 0.6 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {restarting ? 'Restarting...' : 'Restart'}
        </button>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Import Boxer
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              onChange={() => setImportError(null)}
            />
            <button
              onClick={handleImport}
              style={{
                padding: '6px 14px',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 3,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Import
            </button>
          </div>
          {importError && (
            <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{importError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
