import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB } from './db';
import { generateFederationEvents } from './worldGen';
import { getAllFederationEvents } from './federationEventStore';

beforeEach(async () => {
  // @ts-expect-error fake-indexeddb
  global.indexedDB = new IDBFactory();
  await closeAndResetDB();
});

afterEach(async () => {
  await closeAndResetDB();
});

describe('generateFederationEvents', () => {
  it('generates 4 events per federation', async () => {
    await generateFederationEvents(2026, [
      { id: 1, name: 'North America Boxing Federation' },
      { id: 2, name: 'European Boxing Federation' },
    ]);

    const all = await getAllFederationEvents();
    expect(all).toHaveLength(8); // 4 per federation × 2
  });

  it('all events are in the correct year', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    expect(events).toHaveLength(4);
    for (const e of events) {
      expect(e.date.startsWith('2026')).toBe(true);
    }
  });

  it('events have unique dates within a federation', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    const dates = events.map(e => e.date);
    expect(new Set(dates).size).toBe(4);
  });

  it('events start with empty fightIds', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    for (const e of events) {
      expect(e.fightIds).toEqual([]);
    }
  });

  it('event names match format "<ABBR> <Month> <Year>"', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    for (const e of events) {
      expect(e.name).toMatch(/^NABF \w+ 2026$/);
    }
  });

  it('different federations get different event dates in the same quarter', async () => {
    await generateFederationEvents(2026, [
      { id: 1, name: 'North America Boxing Federation' },
      { id: 2, name: 'European Boxing Federation' },
    ]);
    const all = await getAllFederationEvents();
    const fed1Events = all.filter(e => e.federationId === 1).map(e => e.date);
    const fed2Events = all.filter(e => e.federationId === 2).map(e => e.date);
    // No date should appear in both federations
    const overlap = fed1Events.filter(d => fed2Events.includes(d));
    expect(overlap).toHaveLength(0);
  });
});
