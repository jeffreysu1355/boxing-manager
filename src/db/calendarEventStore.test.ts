import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type CalendarEvent } from './db';
import {
  getCalendarEvent,
  getAllCalendarEvents,
  getEventsByBoxer,
  getEventsByFight,
  getEventsByType,
  putCalendarEvent,
  deleteCalendarEvent,
} from './calendarEventStore';

const baseFightEvent: Omit<CalendarEvent, 'id'> = {
  type: 'fight',
  date: '2026-06-01',
  boxerIds: [1, 2],
  fightId: 10,
};

const baseTrainingCamp: Omit<CalendarEvent, 'id'> = {
  type: 'training-camp',
  date: '2026-05-01',
  boxerIds: [1],
  fightId: 10,
  endDate: '2026-05-28',
  intensityLevel: 'moderate',
};

describe('calendarEventStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putCalendarEvent inserts a new event and returns its id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    expect(id).toBe(1);
  });

  it('putCalendarEvent assigns incrementing ids', async () => {
    const id1 = await putCalendarEvent(baseFightEvent);
    const id2 = await putCalendarEvent(baseTrainingCamp);
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getCalendarEvent retrieves an event by id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    const event = await getCalendarEvent(id);
    expect(event?.type).toBe('fight');
    expect(event?.id).toBe(id);
  });

  it('getCalendarEvent returns undefined for a missing id', async () => {
    const event = await getCalendarEvent(999);
    expect(event).toBeUndefined();
  });

  it('getAllCalendarEvents returns all stored events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const events = await getAllCalendarEvents();
    expect(events).toHaveLength(2);
  });

  it('getAllCalendarEvents returns empty array when none exist', async () => {
    const events = await getAllCalendarEvents();
    expect(events).toHaveLength(0);
  });

  it('getEventsByBoxer returns events involving that boxer', async () => {
    await putCalendarEvent(baseFightEvent); // boxerIds: [1, 2]
    await putCalendarEvent({ ...baseFightEvent, boxerIds: [3, 4], fightId: 11 });
    const boxer1Events = await getEventsByBoxer(1);
    expect(boxer1Events).toHaveLength(1);
    expect(boxer1Events[0].boxerIds).toContain(1);
  });

  it('getEventsByBoxer returns empty array when boxer has no events', async () => {
    await putCalendarEvent(baseFightEvent);
    const result = await getEventsByBoxer(99);
    expect(result).toHaveLength(0);
  });

  it('getEventsByFight returns all events for a fightId', async () => {
    await putCalendarEvent(baseFightEvent);    // fightId: 10
    await putCalendarEvent(baseTrainingCamp); // fightId: 10
    await putCalendarEvent({ ...baseFightEvent, fightId: 11, boxerIds: [3, 4] });
    const fight10Events = await getEventsByFight(10);
    expect(fight10Events).toHaveLength(2);
  });

  it('getEventsByFight returns empty array when fightId has no events', async () => {
    await putCalendarEvent(baseFightEvent);
    const result = await getEventsByFight(99);
    expect(result).toHaveLength(0);
  });

  it('getEventsByType returns only fight events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const fights = await getEventsByType('fight');
    expect(fights).toHaveLength(1);
    expect(fights[0].type).toBe('fight');
  });

  it('getEventsByType returns only training-camp events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const camps = await getEventsByType('training-camp');
    expect(camps).toHaveLength(1);
    expect(camps[0].type).toBe('training-camp');
  });

  it('putCalendarEvent updates an existing event when id is present', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    await putCalendarEvent({ ...baseFightEvent, id, date: '2026-07-01' });
    const event = await getCalendarEvent(id);
    expect(event?.date).toBe('2026-07-01');
  });

  it('putCalendarEvent stores optional training-camp fields', async () => {
    const id = await putCalendarEvent(baseTrainingCamp);
    const event = await getCalendarEvent(id);
    expect(event?.endDate).toBe('2026-05-28');
    expect(event?.intensityLevel).toBe('moderate');
  });

  it('putCalendarEvent with id: undefined inserts as a new event', async () => {
    const id = await putCalendarEvent({ ...baseFightEvent, id: undefined });
    expect(id).toBe(1);
  });

  it('deleteCalendarEvent removes an event by id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    await deleteCalendarEvent(id);
    const event = await getCalendarEvent(id);
    expect(event).toBeUndefined();
  });

  it('deleteCalendarEvent does not affect other events', async () => {
    const id1 = await putCalendarEvent(baseFightEvent);
    const id2 = await putCalendarEvent(baseTrainingCamp);
    await deleteCalendarEvent(id1);
    const remaining = await getAllCalendarEvents();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
