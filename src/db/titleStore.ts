import { getDB, type Title, type WeightClass } from './db';

export async function getTitle(id: number): Promise<Title | undefined> {
  const db = await getDB();
  return db.get('titles', id);
}

export async function getAllTitles(): Promise<Title[]> {
  const db = await getDB();
  return db.getAll('titles');
}

export async function getTitlesByFederation(federationId: number): Promise<Title[]> {
  const db = await getDB();
  return db.getAllFromIndex('titles', 'federationId', federationId);
}

export async function getTitlesByWeightClass(weightClass: WeightClass): Promise<Title[]> {
  const db = await getDB();
  return db.getAllFromIndex('titles', 'weightClass', weightClass);
}

export async function putTitle(title: Omit<Title, 'id'> | Title): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = title as Title;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('titles', record as Title);
}

export async function deleteTitle(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('titles', id);
}
