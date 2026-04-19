import { getDB, type Fight } from './db';

export async function getFight(id: number): Promise<Fight | undefined> {
  const db = await getDB();
  return db.get('fights', id);
}

export async function getAllFights(): Promise<Fight[]> {
  const db = await getDB();
  return db.getAll('fights');
}

export async function getFightsByBoxer(boxerId: number): Promise<Fight[]> {
  const db = await getDB();
  return db.getAllFromIndex('fights', 'boxerIds', boxerId);
}

export async function getFightsByFederation(federationId: number): Promise<Fight[]> {
  const db = await getDB();
  return db.getAllFromIndex('fights', 'federationId', federationId);
}

export async function putFight(fight: Omit<Fight, 'id'> | Fight): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = fight as Fight;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('fights', record as Fight);
}

export async function deleteFight(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('fights', id);
}
