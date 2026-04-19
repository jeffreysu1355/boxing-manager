import { getDB, type Boxer, type WeightClass } from './db';

export async function getBoxer(id: number): Promise<Boxer | undefined> {
  const db = await getDB();
  return db.get('boxers', id);
}

export async function getAllBoxers(): Promise<Boxer[]> {
  const db = await getDB();
  return db.getAll('boxers');
}

export async function getBoxersByWeightClass(weightClass: WeightClass): Promise<Boxer[]> {
  const db = await getDB();
  return db.getAllFromIndex('boxers', 'weightClass', weightClass);
}

export async function getBoxersByFederation(federationId: number): Promise<Boxer[]> {
  const db = await getDB();
  return db.getAllFromIndex('boxers', 'federationId', federationId);
}

export async function putBoxer(boxer: Omit<Boxer, 'id'> | Boxer): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = boxer as Boxer;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('boxers', record as Boxer);
}

export async function deleteBoxer(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('boxers', id);
}
