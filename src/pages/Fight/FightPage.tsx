import { useParams, useNavigate } from 'react-router';

export default function FightPage() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px 24px' }}>
      <button
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16 }}
        onClick={() => navigate(-1)}
      >
        &larr; Back
      </button>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Fight #{fightId}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight page coming soon.</p>
    </div>
  );
}
