import { getDB, type Gym } from './db';

const GYM_ID = 1;

export async function getGym(): Promise<Gym | undefined> {
  const db = await getDB();
  return db.get('gym', GYM_ID);
}

export async function saveGym(gym: Omit<Gym, 'id'> | Gym): Promise<void> {
  const db = await getDB();
  await db.put('gym', { ...gym, id: GYM_ID } as Gym);
}

export async function addToWatchlist(boxerId: number): Promise<void> {
  const gym = await getGym();
  if (!gym) return;
  const ids = gym.watchlistIds ?? [];
  if (ids.includes(boxerId)) return;
  await saveGym({ ...gym, watchlistIds: [...ids, boxerId] });
}

export async function removeFromWatchlist(boxerId: number): Promise<void> {
  const gym = await getGym();
  if (!gym) return;
  const ids = gym.watchlistIds ?? [];
  await saveGym({ ...gym, watchlistIds: ids.filter(id => id !== boxerId) });
}
