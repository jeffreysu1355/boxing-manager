import { getDB, type FederationEvent } from './db';

export async function getFederationEvent(id: number): Promise<FederationEvent | undefined> {
  const db = await getDB();
  return db.get('federationEvents', id);
}

export async function getAllFederationEvents(): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAll('federationEvents');
}

export async function getFederationEventsByFederation(federationId: number): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('federationEvents', 'federationId', federationId);
}

export async function getFederationEventsByDate(date: string): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('federationEvents', 'date', date);
}

export async function putFederationEvent(event: Omit<FederationEvent, 'id'> | FederationEvent): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = event as FederationEvent;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('federationEvents', record as FederationEvent);
}

export async function updateFederationEventFights(eventId: number, fightId: number): Promise<void> {
  const db = await getDB();
  const event = await db.get('federationEvents', eventId);
  if (!event) throw new Error(`FederationEvent ${eventId} not found`);
  await db.put('federationEvents', { ...event, fightIds: [...event.fightIds, fightId] });
}

export async function deleteFederationEvent(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('federationEvents', id);
}
