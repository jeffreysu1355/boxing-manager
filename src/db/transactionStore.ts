import { getDB, type GymTransaction } from './db';
import { getGym, saveGym } from './gymStore';

export async function logTransaction(
  tx: Omit<GymTransaction, 'id' | 'balanceAfter'>,
): Promise<number> {
  const gym = await getGym();
  if (!gym) throw new Error('Gym not found');
  const balanceAfter = gym.balance + tx.amount;
  await saveGym({ ...gym, balance: balanceAfter });
  const db = await getDB();
  return db.add('transactions', { ...tx, balanceAfter } as GymTransaction);
}

export async function getAllTransactions(): Promise<GymTransaction[]> {
  const db = await getDB();
  const all = await db.getAll('transactions');
  return all.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
