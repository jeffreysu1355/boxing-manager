import { getDB, type Coach, type FightingStyle } from './db';

export async function getCoach(id: number): Promise<Coach | undefined> {
  const db = await getDB();
  return db.get('coaches', id);
}

export async function getAllCoaches(): Promise<Coach[]> {
  const db = await getDB();
  return db.getAll('coaches');
}

export async function getCoachesByStyle(style: FightingStyle): Promise<Coach[]> {
  const db = await getDB();
  return db.getAllFromIndex('coaches', 'style', style);
}

export async function putCoach(coach: Omit<Coach, 'id'> | Coach): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = coach as Coach;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('coaches', record as Coach);
}

export async function deleteCoach(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('coaches', id);
}
