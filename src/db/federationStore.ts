import { getDB, type Federation, type FederationName } from './db';

export async function getFederation(id: number): Promise<Federation | undefined> {
  const db = await getDB();
  return db.get('federations', id);
}

export async function getAllFederations(): Promise<Federation[]> {
  const db = await getDB();
  return db.getAll('federations');
}

export async function getFederationByName(name: FederationName): Promise<Federation | undefined> {
  const db = await getDB();
  return db.getFromIndex('federations', 'name', name);
}

export async function putFederation(federation: Omit<Federation, 'id'> | Federation): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = federation as Federation;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('federations', record as Federation);
}

export async function deleteFederation(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('federations', id);
}
