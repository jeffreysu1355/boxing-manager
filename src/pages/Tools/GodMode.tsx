import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';

export default function GodMode() {
  const [restarting, setRestarting] = useState(false);

  async function handleRestart() {
    if (!confirm('This will wipe all data and start a fresh world. Continue?')) return;
    setRestarting(true);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('boxing-manager');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // proceed even if blocked; page reload will clean up
    });
    window.location.href = '/';
  }

  return (
    <div>
      <PageHeader title="God Mode" subtitle="Modify stats, natural talents, and history" />
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
        }}
      >
        {restarting ? 'Restarting...' : 'Restart'}
      </button>
    </div>
  );
}
