import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { putBoxer, getAllBoxers } from '../../db/boxerStore';
import { getGym, saveGym } from '../../db/gymStore';
import { RANK_CONFIG, REPUTATION_ORDER } from '../../lib/rankSystem';
import type { Boxer, BoxerStats, NaturalTalent, ReputationLevel } from '../../db/db';

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

export default function ImportBoxerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const imported = (location.state as { boxer: Omit<Boxer, 'id'> } | null)?.boxer;

  const [stats, setStats] = useState<BoxerStats | null>(null);
  const [reputation, setReputation] = useState<ReputationLevel>('Unknown');
  const [rankPoints, setRankPoints] = useState(0);
  const [demotionBuffer, setDemotionBuffer] = useState(0);
  const [naturalTalents, setNaturalTalents] = useState<NaturalTalent[]>([]);
  const [age, setAge] = useState(18);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imported) {
      navigate('/tools/god-mode', { replace: true });
      return;
    }
    getGym().then(gym => {
      if (!gym?.godModeEnabled) {
        navigate('/tools/god-mode', { replace: true });
        return;
      }
      setStats({ ...imported.stats });
      setReputation(imported.reputation);
      setRankPoints(imported.rankPoints ?? 0);
      setDemotionBuffer(imported.demotionBuffer ?? RANK_CONFIG[imported.reputation].bufferMax);
      setNaturalTalents([...imported.naturalTalents]);
      setAge(imported.age);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!imported || !stats) return;
    setSaving(true);
    try {
      const gym = await getGym();
      if (!gym) return;

      const allBoxers = await getAllBoxers();
      const nameMap = new Map<string, number>();
      for (const b of allBoxers) {
        if (b.id !== undefined) nameMap.set(b.name, b.id);
      }

      const resolvedRecord = imported.record.map(r => ({
        ...r,
        opponentId: nameMap.has(r.opponentName) ? (nameMap.get(r.opponentName) ?? null) : null,
      }));

      const newBoxer: Omit<Boxer, 'id'> = {
        ...imported,
        stats,
        reputation,
        rankPoints,
        demotionBuffer,
        naturalTalents,
        age,
        gymId: gym.id ?? 1,
        record: resolvedRecord,
        titles: [], // title IDs are session-specific; strip on cross-session import
        lastRankDelta: undefined,
        retired: false,
      };

      const newId = await putBoxer(newBoxer);
      await saveGym({ ...gym, rosterIds: [...(gym.rosterIds ?? []), newId] });
      navigate(`/player/${newId}`);
    } finally {
      setSaving(false);
    }
  }

  if (!imported || !stats) return null;

  const rankConfig = RANK_CONFIG[reputation];

  return (
    <div>
      <PageHeader title={`Import: ${imported.name}`} subtitle="God Mode — Review stats before adding to roster" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

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

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Natural Talents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {(Object.keys(STAT_LABELS) as (keyof BoxerStats)[]).map(stat => {
              const hasTalent = naturalTalents.some(t => t.stat === stat);
              return (
                <label key={stat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasTalent}
                    onChange={e => {
                      if (e.target.checked) {
                        setNaturalTalents(prev => [...prev, { stat }]);
                      } else {
                        setNaturalTalents(prev => prev.filter(t => t.stat !== stat));
                      }
                    }}
                  />
                  <span style={{ color: hasTalent ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {STAT_LABELS[stat]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Boxer Info
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Age</span>
            <input
              type="number"
              min={16}
              max={60}
              value={age}
              onChange={e => setAge(Math.max(16, Math.min(60, Math.round(Number(e.target.value)))))}
              style={{
                background: 'var(--surface, #1a1a2e)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                padding: '4px 8px',
                fontSize: 13,
                maxWidth: 100,
              }}
            />
          </label>
        </div>

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
            {saving ? 'Saving…' : 'Save & Add to Roster'}
          </button>
          <button
            onClick={() => navigate('/tools/god-mode')}
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
