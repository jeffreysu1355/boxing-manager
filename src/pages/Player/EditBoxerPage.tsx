import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import { RANK_CONFIG, REPUTATION_ORDER } from '../../lib/rankSystem';
import type { Boxer, BoxerStats, ReputationLevel } from '../../db/db';

const STAT_GROUPS: { label: string; stats: (keyof BoxerStats)[] }[] = [
  { label: 'Offense',  stats: ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'] },
  { label: 'Defense',  stats: ['headMovement', 'bodyMovement', 'guard', 'positioning'] },
  { label: 'Mental',   stats: ['timing', 'adaptability', 'discipline'] },
  { label: 'Physical', stats: ['speed', 'power', 'endurance', 'recovery', 'toughness'] },
];

const STAT_LABELS: Record<keyof BoxerStats, string> = {
  jab: 'Jab', cross: 'Cross', leadHook: 'Lead Hook', rearHook: 'Rear Hook', uppercut: 'Uppercut',
  headMovement: 'Head Movement', bodyMovement: 'Body Movement', guard: 'Guard', positioning: 'Positioning',
  timing: 'Timing', adaptability: 'Adaptability', discipline: 'Discipline',
  speed: 'Speed', power: 'Power', endurance: 'Endurance', recovery: 'Recovery', toughness: 'Toughness',
};

function clampStat(val: number): number {
  return Math.max(1, Math.min(25, Math.round(val)));
}

export default function EditBoxerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [boxer, setBoxer] = useState<Boxer | null>(null);
  const [stats, setStats] = useState<BoxerStats | null>(null);
  const [reputation, setReputation] = useState<ReputationLevel>('Unknown');
  const [rankPoints, setRankPoints] = useState(0);
  const [demotionBuffer, setDemotionBuffer] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [b, gym] = await Promise.all([getBoxer(Number(id)), getGym()]);
      if (!gym?.godModeEnabled) {
        navigate(`/player/${id}`, { replace: true });
        return;
      }
      if (!b) {
        navigate('/', { replace: true });
        return;
      }
      setBoxer(b);
      setStats({ ...b.stats });
      setReputation(b.reputation);
      setRankPoints(b.rankPoints ?? 0);
      setDemotionBuffer(b.demotionBuffer ?? RANK_CONFIG[b.reputation].bufferMax);
      setLoading(false);
    }
    load();
  }, [id, navigate]);

  async function handleSave() {
    if (!boxer || !stats) return;
    setSaving(true);
    try {
      await putBoxer({
        ...boxer,
        stats,
        reputation,
        rankPoints,
        demotionBuffer,
        lastRankDelta: undefined,
      });
      navigate(`/player/${boxer.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !boxer || !stats) {
    return (
      <div>
        <PageHeader title="Edit Boxer" subtitle="God Mode" />
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  const rankConfig = RANK_CONFIG[reputation];

  return (
    <div>
      <PageHeader title={`Edit: ${boxer.name}`} subtitle="God Mode" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

        {/* Stats */}
        {STAT_GROUPS.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {group.stats.map(stat => (
                <label key={stat} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{STAT_LABELS[stat]}</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={stats[stat]}
                    onChange={e => setStats(prev => prev ? { ...prev, [stat]: clampStat(Number(e.target.value)) } : prev)}
                    style={{
                      background: 'var(--surface, #1a1a2e)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      color: 'var(--text-primary)',
                      padding: '4px 8px',
                      fontSize: 13,
                      width: '100%',
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Ranking */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Ranking
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Reputation</span>
              <select
                value={reputation}
                onChange={e => {
                  const rep = e.target.value as ReputationLevel;
                  setReputation(rep);
                  setRankPoints(0);
                  setDemotionBuffer(RANK_CONFIG[rep].bufferMax);
                }}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 260,
                }}
              >
                {REPUTATION_ORDER.map(rep => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Rank Points
                {rankConfig.promotionThreshold === Infinity
                  ? ' (max rank — no promotion threshold)'
                  : ` (threshold: ${rankConfig.promotionThreshold} pts)`}
              </span>
              <input
                type="number"
                min={0}
                max={rankConfig.promotionThreshold === Infinity ? 9999 : rankConfig.promotionThreshold}
                value={rankPoints}
                onChange={e => setRankPoints(Math.max(0, Math.round(Number(e.target.value))))}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 120,
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Demotion Buffer (max: {rankConfig.bufferMax} pts)
              </span>
              <input
                type="number"
                min={0}
                max={rankConfig.bufferMax}
                value={demotionBuffer}
                onChange={e => setDemotionBuffer(Math.max(0, Math.min(rankConfig.bufferMax, Math.round(Number(e.target.value)))))}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 120,
                }}
              />
            </label>

          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 20px',
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 3,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => navigate(`/player/${boxer.id}`)}
            style={{
              padding: '6px 16px',
              background: 'none',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
