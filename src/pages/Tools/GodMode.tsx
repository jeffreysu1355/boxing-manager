import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';

export default function GodMode() {
  const [godMode, setGodMode] = useState<boolean>(false);
  const [restarting, setRestarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

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
      </div>
    </div>
  );
}
