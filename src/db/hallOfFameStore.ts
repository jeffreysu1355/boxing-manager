import { getDB, type HallOfFameEntry } from './db';

export async function getAllHofEntries(): Promise<HallOfFameEntry[]> {
  const db = await getDB();
  return db.getAll('hallOfFame');
}

export async function putHofEntry(entry: Omit<HallOfFameEntry, 'id'>): Promise<number> {
  const db = await getDB();
  return db.put('hallOfFame', entry as HallOfFameEntry);
}

export async function getHofEntryByBoxer(boxerId: number): Promise<HallOfFameEntry | undefined> {
  const db = await getDB();
  return db.getFromIndex('hallOfFame', 'boxerId', boxerId);
}
