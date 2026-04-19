import { getDB, type CalendarEvent, type CalendarEventType } from './db';

export async function getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
  const db = await getDB();
  return db.get('calendarEvents', id);
}

export async function getAllCalendarEvents(): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAll('calendarEvents');
}

export async function getEventsByBoxer(boxerId: number): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'boxerIds', boxerId);
}

export async function getEventsByFight(fightId: number): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'fightId', fightId);
}

export async function getEventsByType(type: CalendarEventType): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'type', type);
}

export async function putCalendarEvent(event: Omit<CalendarEvent, 'id'> | CalendarEvent): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = event as CalendarEvent;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('calendarEvents', record as CalendarEvent);
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('calendarEvents', id);
}
