import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import type { Fight, Boxer } from '../../db/db';

export default function FightPage() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();
  const [fight, setFight] = useState<Fight | null>(null);
  const [boxers, setBoxers] = useState<Map<number, Boxer>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fightId) return;
    const id = Number(fightId);

    async function load() {
      const f = await getFight(id);
      if (!f) { setLoading(false); return; }
      setFight(f);

      const entries = await Promise.all(
        f.boxerIds.map(async bid => {
          const b = await getBoxer(bid);
          return b ? ([bid, b] as [number, Boxer]) : null;
        })
      );
      const map = new Map<number, Boxer>();
      for (const entry of entries) {
        if (entry) map.set(entry[0], entry[1]);
      }
      setBoxers(map);
      setLoading(false);
    }

    load();
  }, [fightId]);

  const back = (
    <button
      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16 }}
      onClick={() => navigate(-1)}
    >
      &larr; Back
    </button>
  );

  if (loading) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p></div>;
  if (!fight) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight not found.</p></div>;

  const isDraw = fight.method === 'Draw';
  const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';

  const [boxer1Id, boxer2Id] = fight.boxerIds;
  const boxer1 = boxers.get(boxer1Id);
  const boxer2 = boxer2Id !== undefined ? boxers.get(boxer2Id) : undefined;

  function boxerName(id: number | undefined, boxer: Boxer | undefined): string {
    return boxer?.name ?? (id !== undefined ? `Boxer #${id}` : '—');
  }

  function resultLine(): string {
    if (isDraw) return `Draw — ${fight!.method}`;
    if (fight!.winnerId === null) return 'Result pending';

    const winnerName = boxerName(fight!.winnerId, boxers.get(fight!.winnerId));
    if (isDecision) return `${winnerName} wins by ${fight!.method}`;
    const move = fight!.finishingMove ? ` (${fight!.finishingMove})` : '';
    const timing = fight!.round != null ? ` — Rd. ${fight!.round}` : '';
    const time = fight!.time ? ` (${fight!.time})` : '';
    return `${winnerName} wins by ${fight!.method}${move}${timing}${time}`;
  }

  const isCompleted = fight.winnerId !== null || fight.method === 'Draw';

  return (
    <div style={{ padding: '32px 24px', maxWidth: 600 }}>
      {back}
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>
        {boxerName(boxer1Id, boxer1)} vs. {boxerName(boxer2Id, boxer2)}
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
        {fight.date} {fight.isTitleFight && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>· Title Fight</span>}
      </p>

      {isCompleted ? (
        <div style={{
          background: 'var(--bg-secondary, #1a1a2e)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Result
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{resultLine()}</div>
          {!isDecision && !isDraw && fight.winnerId !== null && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              {fight.method}{fight.finishingMove ? ` · ${fight.finishingMove}` : ''}
              {fight.round != null ? ` · Round ${fight.round}` : ''}
              {fight.time ? ` · ${fight.time}` : ''}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This fight has not taken place yet.</p>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 16 }}>
        {boxer1 && boxer1.id !== undefined && (
          <Link to={`/player/${boxer1.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{boxer1.name}</Link>
        )}
        {boxer2 && boxer2.id !== undefined && (
          <Link to={`/player/${boxer2.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{boxer2.name}</Link>
        )}
      </div>
    </div>
  );
}
