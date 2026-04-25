import { describe, it, expect } from 'vitest';
import { COACH_SKILL_INDEX, GYM_LEVEL_MAX_COACH_SKILL } from './Coaches';
import type { CoachSkillLevel } from '../../db/db';

function maxCoachSkillIndex(gymLevel: number): number {
  const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
  return COACH_SKILL_INDEX[maxSkill];
}

describe('GYM_LEVEL_MAX_COACH_SKILL', () => {
  it('gym level 1 → local coaches only', () => {
    expect(maxCoachSkillIndex(1)).toBe(0);
  });

  it('gym level 3 → local coaches only', () => {
    expect(maxCoachSkillIndex(3)).toBe(0);
  });

  it('gym level 4 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(4)).toBe(1);
  });

  it('gym level 6 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(6)).toBe(1);
  });

  it('gym level 7 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(7)).toBe(2);
  });

  it('gym level 9 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(9)).toBe(2);
  });

  it('gym level 10 → all-time-great coaches visible', () => {
    expect(maxCoachSkillIndex(10)).toBe(3);
  });
});

describe('coach filtering by gym level', () => {
  const allCoaches = [
    { id: 1, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: null },
    { id: 2, skillLevel: 'contender' as CoachSkillLevel, assignedBoxerId: null },
    { id: 3, skillLevel: 'championship-caliber' as CoachSkillLevel, assignedBoxerId: null },
    { id: 4, skillLevel: 'all-time-great' as CoachSkillLevel, assignedBoxerId: null },
    { id: 5, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: 99 },
  ];

  function filterAvailableCoaches(gymLevel: number) {
    const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
    const maxIdx = COACH_SKILL_INDEX[maxSkill];
    return allCoaches.filter(
      c => c.assignedBoxerId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxIdx
    );
  }

  it('gym level 1 shows only local unassigned coaches', () => {
    const result = filterAvailableCoaches(1);
    expect(result.map(c => c.id)).toEqual([1]);
  });

  it('gym level 4 shows local + contender unassigned coaches', () => {
    const result = filterAvailableCoaches(4);
    expect(result.map(c => c.id)).toEqual([1, 2]);
  });

  it('gym level 7 shows local + contender + championship-caliber', () => {
    const result = filterAvailableCoaches(7);
    expect(result.map(c => c.id)).toEqual([1, 2, 3]);
  });

  it('gym level 10 shows all unassigned coaches', () => {
    const result = filterAvailableCoaches(10);
    expect(result.map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it('assigned coaches are never shown regardless of gym level', () => {
    const result = filterAvailableCoaches(10);
    expect(result.find(c => c.id === 5)).toBeUndefined();
  });
});
